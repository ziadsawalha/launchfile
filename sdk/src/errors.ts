/**
 * Structured launch errors.
 *
 * When a Launchfile operation fails, providers throw a LaunchError
 * carrying a LaunchErrorContext with structured diagnostic info.
 * Any tool (CLI, CI, AI, custom scripts) can consume this context.
 */

// --- Launch lifecycle phases ---

/** Phase of the launch lifecycle where the error occurred */
export type LaunchPhase =
	| "prereq"
	| "resolve"
	| "parse"
	| "provision"
	| "build"
	| "release"
	| "start"
	| "health"
	| "bootstrap"
	| "unknown";

// --- Structured error context ---

/** Structured context from a failed launch operation */
export interface LaunchErrorContext {
	/** Unique error ID for correlation */
	id: string;
	/** ISO 8601 timestamp */
	timestamp: string;
	/** Which lifecycle phase failed */
	phase: LaunchPhase;
	/** Which provider was active */
	provider: "docker" | "macos";
	/** Human-readable error message */
	message: string;
	/** Exit code from the failed shell command */
	exitCode?: number;
	/** Tail of stdout (last 200 lines) */
	stdout?: string;
	/** Tail of stderr (last 200 lines) */
	stderr?: string;
	/** The shell command that failed */
	command?: string;
	/** The Launchfile YAML content */
	launchfileYaml?: string;
	/** App name from the Launchfile */
	appName?: string;
	/** Catalog slug or derived name */
	slug?: string;
	/** How the Launchfile was resolved */
	sourceType?: "local" | "catalog" | "url";
	/** Component name if failure is component-specific */
	component?: string;
	/** Runtime from the Launchfile */
	runtime?: string;
	/** Docker image from the Launchfile */
	image?: string;
	/** Tail of container/service logs (last 100 lines) */
	serviceLogs?: string;
	/** Environment variable names that were set (NEVER values) */
	envKeys?: string[];
	/** Resource types required by the app */
	requires?: string[];
	/** OS and architecture (e.g., "darwin/arm64") */
	platform?: string;
}

/** Error class carrying structured launch context */
export class LaunchError extends Error {
	readonly context: LaunchErrorContext;

	constructor(message: string, context: LaunchErrorContext) {
		super(message);
		this.name = "LaunchError";
		this.context = context;
	}

	/** Serialize context to JSON (for ~/.launchfile/last-error.json) */
	toJSON(): LaunchErrorContext {
		return this.context;
	}
}

// --- Utility: tail a string to the last N lines ---

/** Keep only the last N lines of a string */
export function tailLines(text: string, maxLines: number): string {
	const lines = text.split("\n");
	if (lines.length <= maxLines) return text;
	return lines.slice(-maxLines).join("\n");
}

/** Generate a unique error ID */
export function errorId(): string {
	return crypto.randomUUID().slice(0, 12);
}
