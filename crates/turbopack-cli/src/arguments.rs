use std::{
    net::IpAddr,
    path::{Path, PathBuf},
    str::FromStr,
};

use anyhow::anyhow;
use bincode::{Decode, Encode};
use clap::{Args, Parser, ValueEnum};
use turbo_tasks::trace::TraceRawVcs;
use turbopack_core::issue::IssueSeverity;

#[derive(Debug, Parser)]
#[clap(author, version, about, long_about = None)]
pub enum Arguments {
    Build(BuildArguments),
    Dev(DevArguments),
}

impl Arguments {
    /// The directory of the application. see [CommonArguments]::dir
    pub fn dir(&self) -> Option<&Path> {
        match self {
            Arguments::Build(args) => args.common.dir.as_deref(),
            Arguments::Dev(args) => args.common.dir.as_deref(),
        }
    }

    /// The number of worker threads to use. see [CommonArguments]::worker_threads
    pub fn worker_threads(&self) -> Option<usize> {
        match self {
            Arguments::Build(args) => args.common.worker_threads,
            Arguments::Dev(args) => args.common.worker_threads,
        }
    }
}

#[turbo_tasks::task_input]
#[derive(Copy, Clone, Debug, ValueEnum, PartialEq, Eq, Hash, TraceRawVcs, Encode, Decode)]
pub enum Target {
    Browser,
    Node,
}

#[derive(Debug, Args, Clone)]
pub struct CommonArguments {
    /// The entrypoints of the project. Resolved relative to the project's
    /// directory (`--dir`).
    #[clap(value_parser)]
    pub entries: Option<Vec<String>>,

    /// The directory of the application.
    /// If no directory is provided, the current directory will be used.
    #[clap(short, long, value_parser)]
    pub dir: Option<PathBuf>,

    /// The root directory of the project. Nothing outside of this directory can
    /// be accessed. e. g. the monorepo root.
    /// If no directory is provided, `dir` will be used.
    #[clap(long, value_parser)]
    pub root: Option<PathBuf>,

    /// Filter by issue severity.
    #[clap(short, long)]
    pub log_level: Option<IssueSeverityCliOption>,

    /// Show all log messages without limit.
    #[clap(long)]
    pub show_all: bool,

    /// Expand the log details.
    #[clap(long)]
    pub log_detail: bool,

    /// Whether to enable full task stats recording in Turbo Engine.
    #[clap(long)]
    pub full_stats: bool,

    /// Whether to build for the `browser` or `node`
    #[clap(long)]
    pub target: Option<Target>,

    /// Number of worker threads to use for parallel processing
    #[clap(long)]
    pub worker_threads: Option<usize>,

    /// Enable filesystem-backed persistent caching.
    /// Cache is stored at `<cache-dir>/<git-version>`.
    #[clap(long)]
    pub persistent_caching: bool,

    /// Directory to store the persistent cache.
    /// Defaults to `.turbopack/cache` relative to the project directory.
    #[clap(long)]
    pub cache_dir: Option<PathBuf>,
    // Enable experimental garbage collection with the provided memory limit in
    // MB.
    // #[clap(long)]
    // pub memory_limit: Option<usize>,
}

#[derive(Copy, Clone, Debug, ValueEnum, PartialEq, Eq)]
pub enum TurbopackMemoryEviction {
    Off,
    Full,
}

impl TurbopackMemoryEviction {
    pub fn from_cli_and_env(cli_value: Option<Self>, raw_env: Option<&str>) -> Self {
        if let Some(cli_value) = cli_value {
            return cli_value;
        }

        match raw_env {
            None | Some("1") | Some("true") => Self::Full,
            _ => Self::Off,
        }
    }

    pub fn evicts_after_snapshot(self) -> bool {
        matches!(self, Self::Full)
    }
}

#[derive(Debug, Args)]
#[clap(author, version, about, long_about = None)]
pub struct DevArguments {
    #[clap(flatten)]
    pub common: CommonArguments,

    /// The port number on which to start the application.
    #[clap(short, long, value_parser, default_value_t = 3000, env = "PORT")]
    pub port: u16,

    /// Hostname on which to start the application.
    #[clap(short = 'H', long, value_parser, default_value = "0.0.0.0")]
    pub hostname: IpAddr,

    /// Compile all, instead of only compiling referenced assets when their
    /// parent asset is requested.
    #[clap(long)]
    pub eager_compile: bool,

    /// Don't open the browser automatically when the dev server has started.
    #[clap(long)]
    pub no_open: bool,

    /// If port is not explicitly specified, use a different port if it is
    /// already in use.
    #[clap(long)]
    pub allow_retry: bool,

    /// Controls Turbopack memory eviction after persistent cache snapshots.
    ///
    /// `full` evicts evictable tasks after every snapshot; `off` disables
    /// eviction. Defaults to `full`, matching Next.js, unless
    /// `TURBO_ENGINE_EVICT_AFTER_SNAPSHOT` is set to a value other than `1` or
    /// `true`.
    #[clap(long, value_enum)]
    pub turbopack_memory_eviction: Option<TurbopackMemoryEviction>,
}

#[derive(Debug, Args)]
#[clap(author, version, about, long_about = None)]
pub struct BuildArguments {
    #[clap(flatten)]
    pub common: CommonArguments,

    /// Don't generate sourcemaps.
    #[clap(long)]
    pub no_sourcemap: bool,

    /// Don't minify build output.
    #[clap(long)]
    pub no_minify: bool,

    /// Perform scope hoisting.
    #[clap(long)]
    pub scope_hoist: bool,

    /// Don't perform scope hoisting.
    #[clap(long)]
    pub no_scope_hoist: bool,

    /// Add a webpack loader rule as `<glob>=<loader>`.
    #[clap(long = "webpack-loader-rule", value_parser)]
    pub webpack_loader_rule: Vec<String>,

    /// Drop the `TurboTasks` object upon exit. By default we intentionally leak this memory, as
    /// we're about to exit the process anyways, but that can cause issues with valgrind or other
    /// leak detectors.
    #[clap(long, hide = true)]
    pub force_memory_cleanup: bool,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct IssueSeverityCliOption(pub IssueSeverity);

impl ValueEnum for IssueSeverityCliOption {
    fn value_variants<'a>() -> &'a [Self] {
        const VARIANTS: [IssueSeverityCliOption; 8] = [
            IssueSeverityCliOption(IssueSeverity::Bug),
            IssueSeverityCliOption(IssueSeverity::Fatal),
            IssueSeverityCliOption(IssueSeverity::Error),
            IssueSeverityCliOption(IssueSeverity::Warning),
            IssueSeverityCliOption(IssueSeverity::Hint),
            IssueSeverityCliOption(IssueSeverity::Note),
            IssueSeverityCliOption(IssueSeverity::Suggestion),
            IssueSeverityCliOption(IssueSeverity::Info),
        ];
        &VARIANTS
    }

    fn to_possible_value<'a>(&self) -> Option<clap::builder::PossibleValue> {
        Some(clap::builder::PossibleValue::new(self.0.as_str()).help(self.0.as_help_str()))
    }
}

impl FromStr for IssueSeverityCliOption {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        <IssueSeverityCliOption as clap::ValueEnum>::from_str(s, true).map_err(|s| anyhow!("{}", s))
    }
}

#[cfg(test)]
mod tests {
    use clap::Parser;

    use super::{Arguments, TurbopackMemoryEviction};

    #[test]
    fn dev_accepts_explicit_memory_eviction_mode() {
        let Arguments::Dev(args) = Arguments::try_parse_from([
            "turbopack-cli",
            "dev",
            "--persistent-caching",
            "--turbopack-memory-eviction",
            "off",
        ])
        .unwrap() else {
            panic!("expected dev arguments");
        };

        assert!(args.common.persistent_caching);
        assert_eq!(
            args.turbopack_memory_eviction,
            Some(TurbopackMemoryEviction::Off)
        );
    }

    #[test]
    fn cli_memory_eviction_value_overrides_env() {
        assert_eq!(
            TurbopackMemoryEviction::from_cli_and_env(
                Some(TurbopackMemoryEviction::Off),
                Some("true"),
            ),
            TurbopackMemoryEviction::Off
        );
        assert_eq!(
            TurbopackMemoryEviction::from_cli_and_env(
                Some(TurbopackMemoryEviction::Full),
                Some("0"),
            ),
            TurbopackMemoryEviction::Full
        );
    }

    #[test]
    fn memory_eviction_env_fallback_matches_next_config_normalization() {
        assert_eq!(
            TurbopackMemoryEviction::from_cli_and_env(None, None),
            TurbopackMemoryEviction::Full
        );
        assert_eq!(
            TurbopackMemoryEviction::from_cli_and_env(None, Some("1")),
            TurbopackMemoryEviction::Full
        );
        assert_eq!(
            TurbopackMemoryEviction::from_cli_and_env(None, Some("true")),
            TurbopackMemoryEviction::Full
        );
        assert_eq!(
            TurbopackMemoryEviction::from_cli_and_env(None, Some("0")),
            TurbopackMemoryEviction::Off
        );
        assert_eq!(
            TurbopackMemoryEviction::from_cli_and_env(None, Some("false")),
            TurbopackMemoryEviction::Off
        );
    }
}
