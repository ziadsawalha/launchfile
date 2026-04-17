/**
 * launchfile diagnose — display structured context from the last launch failure.
 *
 * Reads ~/.launchfile/last-error.json (saved automatically when `launchfile up` fails)
 * and formats it for human review or machine consumption.
 *
 * Usage:
 *   launchfile diagnose          Format last error in detail
 *   launchfile diagnose --json   Dump raw LaunchErrorContext as JSON (for piping)
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { LaunchErrorContext } from "@launchfile/sdk";

const LAST_ERROR_PATH = join(homedir(), ".launchfile", "last-error.json");

export async function handleDiagnose(opts: { json?: boolean } = {}): Promise<void> {
	if (!existsSync(LAST_ERROR_PATH)) {
		console.log("No recent errors. Run `launchfile up` first — errors are captured automatically.");
		return;
	}

	let context: LaunchErrorContext;
	try {
		context = JSON.parse(readFileSync(LAST_ERROR_PATH, "utf-8")) as LaunchErrorContext;
	} catch {
		console.error(`Failed to read ${LAST_ERROR_PATH}`);
		process.exit(1);
	}

	// JSON mode: dump raw context and exit
	if (opts.json) {
		console.log(JSON.stringify(context, null, 2));
		return;
	}

	// Human-readable mode
	console.log(`\nLast error: ${context.phase} phase failure (${context.provider} provider)\n`);

	const details: [string, string | number | undefined][] = [
		["Command", context.command],
		["Exit code", context.exitCode],
		["App", formatApp(context)],
		["Image", context.image],
		["Runtime", context.runtime],
		["Requires", context.requires?.join(", ")],
		["Source", context.sourceType],
		["Component", context.component],
		["Time", context.timestamp],
		["Error ID", context.id],
	];

	for (const [label, value] of details) {
		if (value !== undefined && value !== null) {
			console.log(`  ${label.padEnd(12)} ${value}`);
		}
	}

	// Error message
	console.log(`\n  Error: ${context.message}`);

	// stderr excerpt
	if (context.stderr) {
		const lines = context.stderr.split("\n");
		const excerpt = lines.slice(-20);
		console.log(`\n  stderr (last ${excerpt.length} lines):`);
		for (const line of excerpt) {
			console.log(`    ${line}`);
		}
	}

	// stdout excerpt (if no stderr, or if it's a build error where stdout matters)
	if (context.stdout && !context.stderr) {
		const lines = context.stdout.split("\n");
		const excerpt = lines.slice(-20);
		console.log(`\n  stdout (last ${excerpt.length} lines):`);
		for (const line of excerpt) {
			console.log(`    ${line}`);
		}
	}

	// Service logs
	if (context.serviceLogs) {
		const lines = context.serviceLogs.split("\n");
		const excerpt = lines.slice(-20);
		console.log(`\n  Service logs (last ${excerpt.length} lines):`);
		for (const line of excerpt) {
			console.log(`    ${line}`);
		}
	}

	// Footer
	console.log(`\n  Full context: ${LAST_ERROR_PATH}`);
	console.log(`  JSON output:  launchfile diagnose --json`);
}

function formatApp(ctx: LaunchErrorContext): string | undefined {
	if (!ctx.appName && !ctx.slug) return undefined;
	const name = ctx.appName ?? ctx.slug ?? "";
	const source = ctx.sourceType ? ` (${ctx.sourceType})` : "";
	return `${name}${source}`;
}
