import fsp from "node:fs/promises";
import fs from "fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const args = process.argv.slice(2);

const fileUrl = `https://api.github.com/users/${args[0]}/events`;
const outputPath = path.join(__dirname, "events.json");

async function downloadFile(url, outputPath) {
	if (!args[0]) {
		console.error("Please provide a GitHub username.");
		process.exit(1);
	}
	const response = await fetch(url, {
		headers: {
			"User-Agent": "node-js-app",
		},
	});

	if (!response.ok || !response.body) {
		await response.body?.cancel();
		throw new Error(
			`Failed to fetch ${url}. Status: ${response.status}. Ensure the username exists`,
		);
	}

	const fileStream = fs.createWriteStream(outputPath);
	console.log(`Downloading file from ${url} to ${outputPath}`);

	await pipeline(response.body, fileStream);
	console.log("File downloaded successfully");
}

async function processEvents(filePath) {
	const rawData = await fsp.readFile(filePath, "utf-8");
	const events = JSON.parse(rawData);

	if (events.length === 0) {
		console.log("No recent activity found for this user");
		return;
	}

	events.forEach((event) => {
		let action = "";
		const repo = event.repo.name;

		switch (event.type) {
			case "PushEvent":
				const size = event.payload.size;
				const commits = event.payload.commits?.length;

				// If we have a number, show it. If not, just say "Pushed changes"
				const count = size ?? commits;

				if (count !== undefined) {
					action = `Pushed ${count} commit(s) to ${repo}`;
				} else {
					action = `Pushed changes to ${repo}`;
				}
                break;
			case "IssuesEvent":
				action = `${event.payload?.action.charAt(0).toUpperCase() + event.payload.action.slice(1)} an issue in ${repo}`;
				break;
			case "WatchEvent":
				action = `Starred ${repo}`;
				break;
			case "CreateEvent":
				action = `Created ${event.payload.ref_type} in ${repo}`;
				break;
			default:
				action = `${event.type.replace("Event", "")} in ${repo}`;
				break;
		}
		console.log(`- ${action}`);
	});
}

try {
	// await downloadFile(fileUrl, outputPath);
	await processEvents(outputPath);
} catch (err) {
	console.error(`Error: ${err.message}`);
}
