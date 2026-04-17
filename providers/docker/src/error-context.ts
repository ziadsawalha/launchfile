/**
 * Builds structured LaunchErrorContext from a failed docker operation.
 *
 * Called by provider.ts when a lifecycle phase fails. Assembles all
 * available diagnostic info into a standard format that any tool
 * (CLI, CI, AI, custom scripts) can consume.
 */

import { arch, platform } from "node:os";
import { type LaunchErrorContext, type LaunchPhase, errorId, tailLines } from "@launchfile/sdk";
import type { ShellResult } from "./shell.js";
import type { ResolvedSource } from "./source-resolver.js";
import type { NormalizedLaunch } from "@launchfile/sdk";

export interface ErrorContextOpts {
	/** The resolved source (slug, yaml, source type) */
	resolved?: ResolvedSource;
	/** The parsed Launchfile (if parsing succeeded) */
	launch?: NormalizedLaunch;
	/** Shell result from the failed command */
	shellResult?: ShellResult;
	/** The shell command that failed */
	command?: string;
	/** Component name if failure is component-specific */
	component?: string;
	/** Container/service logs (for start/health failures) */
	serviceLogs?: string;
}

/** Build a LaunchErrorContext from a failed docker operation */
export function buildErrorContext(
	phase: LaunchPhase,
	message: string,
	opts: ErrorContextOpts = {},
): LaunchErrorContext {
	const { resolved, launch, shellResult, command, component, serviceLogs } = opts;

	// Extract env var names from the Launchfile (never values)
	const envKeys = extractEnvKeys(launch);

	// Extract requires from the Launchfile
	const requires = extractRequires(launch);

	return {
		id: errorId(),
		timestamp: new Date().toISOString(),
		phase,
		provider: "docker",
		message,
		exitCode: shellResult?.exitCode,
		stdout: shellResult?.stdout ? tailLines(shellResult.stdout, 200) : undefined,
		stderr: shellResult?.stderr ? tailLines(shellResult.stderr, 200) : undefined,
		command,
		launchfileYaml: resolved?.yaml,
		appName: launch?.name,
		slug: resolved?.slug,
		sourceType: resolved?.source,
		component,
		runtime: extractRuntime(launch),
		image: extractImage(launch),
		serviceLogs: serviceLogs ? tailLines(serviceLogs, 100) : undefined,
		envKeys: envKeys.length > 0 ? envKeys : undefined,
		requires: requires.length > 0 ? requires : undefined,
		platform: `${platform()}/${arch()}`,
	};
}

/** Extract environment variable names from the Launchfile (never values) */
function extractEnvKeys(launch?: NormalizedLaunch): string[] {
	if (!launch) return [];
	const keys = new Set<string>();
	for (const comp of Object.values(launch.components)) {
		if (comp.env) {
			for (const key of Object.keys(comp.env)) {
				keys.add(key);
			}
		}
	}
	return [...keys].sort();
}

/** Extract required resource types from the Launchfile */
function extractRequires(launch?: NormalizedLaunch): string[] {
	if (!launch) return [];
	const types = new Set<string>();
	for (const comp of Object.values(launch.components)) {
		if (comp.requires) {
			for (const req of comp.requires) {
				types.add(req.type);
			}
		}
	}
	return [...types].sort();
}

/** Extract the primary runtime from the first component */
function extractRuntime(launch?: NormalizedLaunch): string | undefined {
	if (!launch) return undefined;
	for (const comp of Object.values(launch.components)) {
		if (comp.runtime) return comp.runtime;
	}
	return undefined;
}

/** Extract the primary image from the first component */
function extractImage(launch?: NormalizedLaunch): string | undefined {
	if (!launch) return undefined;
	for (const comp of Object.values(launch.components)) {
		if (comp.image) return comp.image;
	}
	return undefined;
}
