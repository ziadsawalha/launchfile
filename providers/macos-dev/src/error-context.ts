/**
 * Builds structured LaunchErrorContext from a failed macOS dev operation.
 *
 * Called by provider.ts when a lifecycle phase fails. Assembles all
 * available diagnostic info into a standard format that any tool
 * (CLI, CI, AI, custom scripts) can consume.
 */

import { arch, platform } from "node:os";
import { type LaunchErrorContext, type LaunchPhase, errorId, tailLines } from "@launchfile/sdk";
import type { NormalizedLaunch } from "@launchfile/sdk";

export interface ErrorContextOpts {
	/** The parsed Launchfile (if parsing succeeded) */
	launch?: NormalizedLaunch;
	/** The raw Launchfile YAML */
	launchfileYaml?: string;
	/** Exit code from the failed shell command */
	exitCode?: number;
	/** stdout from the failed command */
	stdout?: string;
	/** stderr from the failed command */
	stderr?: string;
	/** The shell command that failed */
	command?: string;
	/** Component name if failure is component-specific */
	component?: string;
}

/** Build a LaunchErrorContext from a failed macOS dev operation */
export function buildErrorContext(
	phase: LaunchPhase,
	message: string,
	opts: ErrorContextOpts = {},
): LaunchErrorContext {
	const { launch, launchfileYaml, exitCode, stdout, stderr, command, component } = opts;

	return {
		id: errorId(),
		timestamp: new Date().toISOString(),
		phase,
		provider: "macos",
		message,
		exitCode,
		stdout: stdout ? tailLines(stdout, 200) : undefined,
		stderr: stderr ? tailLines(stderr, 200) : undefined,
		command,
		launchfileYaml,
		appName: launch?.name,
		slug: launch?.name,
		sourceType: "local",
		component,
		runtime: extractRuntime(launch),
		envKeys: extractEnvKeys(launch),
		requires: extractRequires(launch),
		platform: `${platform()}/${arch()}`,
	};
}

/** Extract environment variable names from the Launchfile (never values) */
function extractEnvKeys(launch?: NormalizedLaunch): string[] | undefined {
	if (!launch) return undefined;
	const keys = new Set<string>();
	for (const comp of Object.values(launch.components)) {
		if (comp.env) {
			for (const key of Object.keys(comp.env)) {
				keys.add(key);
			}
		}
	}
	return keys.size > 0 ? [...keys].sort() : undefined;
}

/** Extract required resource types from the Launchfile */
function extractRequires(launch?: NormalizedLaunch): string[] | undefined {
	if (!launch) return undefined;
	const types = new Set<string>();
	for (const comp of Object.values(launch.components)) {
		if (comp.requires) {
			for (const req of comp.requires) {
				types.add(req.type);
			}
		}
	}
	return types.size > 0 ? [...types].sort() : undefined;
}

/** Extract the primary runtime from the first component */
function extractRuntime(launch?: NormalizedLaunch): string | undefined {
	if (!launch) return undefined;
	for (const comp of Object.values(launch.components)) {
		if (comp.runtime) return comp.runtime;
	}
	return undefined;
}
