import { id, tx } from "@instantdb/core";
import { db } from "../../database/getDatabase";
import { Agent } from "../../framework/agent";

const { SAKURA_TOKEN, SAKURA_CLIENT_ID } = process.env;
if (!SAKURA_TOKEN || !SAKURA_CLIENT_ID) {
	throw new Error(
		"Environment variables SAKURA_TOKEN and SAKURA_CLIENT_ID must be set.",
	);
}

export const agent = new Agent({
	name: "sakura",
	token: SAKURA_TOKEN,
	clientId: SAKURA_CLIENT_ID,
	intents: ["Guilds", "GuildMessages", "MessageContent"],
	messageScope: {
		readMentionsOnly: true,
		readBotsMessages: false,
	},
});

agent.on("messageCreate", async (message) => {
	if (!agent.messageInScope(message)) return;

	const content = message.cleanContent.toLowerCase();
	const command = content.split(" ").at(-1);

	switch (command) {
		case "start":
			try {
				const sessionId = await startSession(message.author.id);
				await message.reply(`Started a new study session. ID: ${sessionId}`);
			} catch (error) {
				await message.reply("Failed to start session. Please try again.");
			}
			break;

		case "end":
			try {
				const [sessionId] = args;
				if (!sessionId) {
					await message.reply("Please provide a session ID.");
					return;
				}
				const result = await endSession(sessionId);
				const durationMinutes = Math.round(result.duration / 60000);
				await message.reply(
					`Ended study session. Duration: ${durationMinutes} minutes.`,
				);
			} catch (error) {
				await message.reply(
					"Failed to end session. Please check the session ID and try again.",
				);
			}
			break;

		case "sessions":
			try {
				const sessions = await getUserSessions(message.author.id);
				if (sessions.length === 0) {
					await message.reply("You have no recorded study sessions.");
				} else {
					const sessionList = sessions
						.map((s) => {
							const duration = s.endTime
								? `${Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000)} minutes`
								: "Ongoing";
							return `ID: ${s.id}, Duration: ${duration}`;
						})
						.join("\n");
					await message.reply(`Your study sessions:\n${sessionList}`);
				}
			} catch (error) {
				await message.reply("Failed to fetch sessions. Please try again.");
			}
			break;

		default:
			await message.reply(
				"Unknown command. Available commands: start, end, sessions",
			);
	}
});

const startSession = async (userId: string) => {
	const sessionId = id();
	const startTime = new Date().toISOString();

	await db.transact([
		tx.sessions[sessionId].update({
			startTime,
		}),
		tx.sessions[sessionId].link({ user: userId }),
	]);

	return sessionId;
};

const endSession = async (sessionId: string) => {
	const endTime = new Date();
	const { data } = await db.queryOnce({
		sessions: {
			$: {
				where: { id: sessionId },
			},
		},
	});

	const session = data?.sessions?.[0];

	if (!session) {
		throw new Error("Session not found");
	}

	if (!session.startTime) {
		throw new Error("Invalid session: missing start time");
	}

	const duration = endTime.getTime() - new Date(session.startTime).getTime();

	await db.transact([
		tx.sessions[sessionId].update({
			endTime: endTime.toISOString(),
			duration,
		}),
	]);

	return { sessionId, duration };
};

const getUserSessions = async (userId: string) => {
	const { data } = await db.queryOnce({
		users: {
			id: userId,
			sessions: {},
		},
	});
	return data.users[0]?.sessions || [];
};
