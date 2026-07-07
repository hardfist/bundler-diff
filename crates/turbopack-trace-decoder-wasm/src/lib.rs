use std::{borrow::Cow, cell::RefCell, slice};

use serde::{Deserialize, Serialize};

const RAW_TRACE_MAGIC: &[u8] = b"TRACEv0";

thread_local! {
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

#[derive(Debug, Serialize, Deserialize)]
pub enum TraceRow<'a> {
    Start {
        ts: u64,
        id: u64,
        parent: Option<u64>,
        #[serde(borrow)]
        name: Cow<'a, str>,
        #[serde(borrow)]
        target: Cow<'a, str>,
        #[serde(borrow)]
        values: Vec<(Cow<'a, str>, TraceValue<'a>)>,
    },
    End {
        ts: u64,
        id: u64,
    },
    Enter {
        ts: u64,
        id: u64,
        thread_id: u64,
    },
    Exit {
        ts: u64,
        id: u64,
        thread_id: u64,
    },
    Event {
        ts: u64,
        parent: Option<u64>,
        #[serde(borrow)]
        values: Vec<(Cow<'a, str>, TraceValue<'a>)>,
    },
    Record {
        id: u64,
        #[serde(borrow)]
        values: Vec<(Cow<'a, str>, TraceValue<'a>)>,
    },
    Allocation {
        ts: u64,
        thread_id: u64,
        allocations: u64,
        allocation_count: u64,
        deallocations: u64,
        deallocation_count: u64,
    },
    AllocationCounters {
        ts: u64,
        thread_id: u64,
        allocations: u64,
        allocation_count: u64,
        deallocations: u64,
        deallocation_count: u64,
    },
    MemorySample {
        ts: u64,
        memory: u64,
        memory_pressure: u8,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub enum TraceValue<'a> {
    String(#[serde(borrow)] Cow<'a, str>),
    Bool(bool),
    UInt(u64),
    Int(i64),
    Float(f64),
}

#[derive(Serialize)]
struct DecodeSuccess<'a> {
    format: &'static str,
    version: u8,
    bytes_read: usize,
    payload_bytes_read: usize,
    remaining_bytes: usize,
    row_count: usize,
    rows: Vec<TraceRow<'a>>,
}

#[derive(Serialize)]
struct DecodeFailure {
    error: String,
    bytes_read: usize,
    remaining_bytes: usize,
}

pub fn decode_turbopack_trace_rows_json(input: &[u8]) -> Result<Vec<u8>, serde_json::Error> {
    let (payload, magic_bytes_read) = if input.starts_with(RAW_TRACE_MAGIC) {
        (&input[RAW_TRACE_MAGIC.len()..], RAW_TRACE_MAGIC.len())
    } else {
        (input, 0)
    };

    let mut rows = Vec::new();
    let mut remaining = payload;
    let mut payload_bytes_read = 0;

    loop {
        match postcard::take_from_bytes::<TraceRow<'_>>(remaining) {
            Ok((row, next)) => {
                payload_bytes_read += remaining.len() - next.len();
                remaining = next;
                rows.push(row);
            }
            Err(postcard::Error::DeserializeUnexpectedEnd) => break,
            Err(error) => {
                return serde_json::to_vec(&DecodeFailure {
                    error: error.to_string(),
                    bytes_read: magic_bytes_read + payload_bytes_read,
                    remaining_bytes: remaining.len(),
                });
            }
        }
    }

    serde_json::to_vec(&DecodeSuccess {
        format: "turbopack-raw-trace",
        version: 0,
        bytes_read: magic_bytes_read + payload_bytes_read,
        payload_bytes_read,
        remaining_bytes: remaining.len(),
        row_count: rows.len(),
        rows,
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn turbopack_trace_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::with_capacity(len);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn turbopack_trace_dealloc(ptr: *mut u8, len: usize) {
    if !ptr.is_null() && len > 0 {
        unsafe {
            drop(Vec::from_raw_parts(ptr, len, len));
        }
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn turbopack_trace_decode(ptr: *const u8, len: usize) -> u32 {
    let input = if ptr.is_null() && len == 0 {
        &[]
    } else {
        unsafe { slice::from_raw_parts(ptr, len) }
    };

    let json = decode_turbopack_trace_rows_json(input).unwrap_or_else(|error| {
        serde_json::to_vec(&DecodeFailure {
            error: error.to_string(),
            bytes_read: 0,
            remaining_bytes: len,
        })
        .expect("serializing decode failure should not fail")
    });

    let success = serde_json::from_slice::<serde_json::Value>(&json)
        .ok()
        .and_then(|value| value.get("format").cloned())
        .is_some();

    OUTPUT.with(|output| {
        *output.borrow_mut() = json;
    });

    u32::from(success)
}

#[unsafe(no_mangle)]
pub extern "C" fn turbopack_trace_output_ptr() -> *const u8 {
    OUTPUT.with(|output| output.borrow().as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn turbopack_trace_output_len() -> usize {
    OUTPUT.with(|output| output.borrow().len())
}

#[unsafe(no_mangle)]
pub extern "C" fn turbopack_trace_clear_output() {
    OUTPUT.with(|output| output.borrow_mut().clear());
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    use super::{TraceRow, TraceValue, decode_turbopack_trace_rows_json};

    #[test]
    fn decodes_magic_prefixed_trace_rows_to_json() {
        let mut trace = b"TRACEv0".to_vec();
        trace.extend(
            postcard::to_allocvec(&TraceRow::Start {
                ts: 10,
                id: 1,
                parent: None,
                name: "build".into(),
                target: "turbo_tasks".into(),
                values: vec![("phase".into(), TraceValue::String("cold".into()))],
            })
            .unwrap(),
        );
        trace.extend(postcard::to_allocvec(&TraceRow::End { ts: 20, id: 1 }).unwrap());

        let json = decode_turbopack_trace_rows_json(&trace).unwrap();
        let decoded: Value = serde_json::from_slice(&json).unwrap();

        assert_eq!(decoded["format"], "turbopack-raw-trace");
        assert_eq!(decoded["version"], 0);
        assert_eq!(decoded["row_count"], 2);
        assert_eq!(decoded["remaining_bytes"], 0);
        assert_eq!(decoded["rows"][0]["Start"]["name"], "build");
        assert_eq!(decoded["rows"][0]["Start"]["values"][0][0], "phase");
    }

    #[test]
    fn keeps_partial_trailing_rows_as_remaining_bytes() {
        let mut trace = postcard::to_allocvec(&TraceRow::End { ts: 20, id: 1 }).unwrap();
        trace.push(0xff);

        let json = decode_turbopack_trace_rows_json(&trace).unwrap();
        let decoded: Value = serde_json::from_slice(&json).unwrap();

        assert_eq!(decoded["row_count"], 1);
        assert_eq!(decoded["payload_bytes_read"], trace.len() - 1);
        assert_eq!(decoded["remaining_bytes"], 1);
    }
}
