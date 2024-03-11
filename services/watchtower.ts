import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.WATCHTOWER_PORT;
const secret = process.env.GITHUB_WEBHOOK_SECRET;

if (!secret) throw new Error("GITHUB_WEBHOOK_SECRET is not defined");
if (!port) throw new Error("WATCHTOWER_PORT is not defined");

app.use(express.json());

app.post("/hook", (req, res) => {
	const { body } = req;

	const githubSignature = req.headers["x-hub-signature"] as string;
	if (!githubSignature) {
		console.error("GitHub signature is not defined", req.headers);
		return res
			.status(400)
			.send("Invalid request: GitHub signature is not defined");
	}

	const githubEvent = req.headers["x-github-event"] as string;
	const isGithubPushEvent = githubEvent === "push";

	if (!isGithubPushEvent) {
		console.log("Ignoring event", githubEvent, "Reason: not a push event");
		return res.status(200).send("Webhook received successfully");
	}

	// Verify signature
	verifySignature(req, res);

	// Trigger action
	console.log("New commit pushed:", body.head_commit.id);

	res.status(200).send("Webhook received successfully");
});

function verifySignature(req: express.Request, res: express.Response) {
	const githubSignature = req.headers["x-hub-signature"] as string;
	if (!githubSignature) {
		console.error("GitHub signature is not defined", req.headers);
		return res
			.status(400)
			.send("Invalid request: GitHub signature is not defined");
	}

	// Verify signature
	const crypto = require("crypto");
	const hmac = crypto.createHmac("sha1", secret);
	const payload = JSON.stringify(req.body);
	const expectedSignature = `sha1=${hmac.update(payload).digest("hex")}`;
	if (
		!crypto.timingSafeEqual(
			Buffer.from(githubSignature),
			Buffer.from(expectedSignature),
		)
	) {
		console.error("GitHub signature verification failed");
		res.status(400).send("GitHub signature verification failed");
	} else {
		console.log("GitHub signature verified");
	}
}

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});