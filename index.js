// @ts-check

import { inspect } from "node:util";
import { createServer, ServerResponse } from "node:http";

import { Octokit } from "@octokit/core";
import { verifyRequestByKeyId } from "@copilot-extensions/preview-sdk";

// Create a local server to receive data from
const server = createServer(async (request, response) => {
  console.log(request.method, request.url, {
    ...request.headers,
    "x-github-token": "REDACTED",
  });

  if (request.method === "GET") {
    response.statusCode = 200;
    response.end(`Hello, there!`);
    return;
  }

  const body = await getBody(request);
  const signature = String(request.headers["github-public-key-signature"]);
  const keyID = String(request.headers["github-public-key-identifier"]);
  const tokenForUser = String(request.headers["x-github-token"]);

  try {
    const isValidRequest = await verifyRequestByKeyId(body, signature, keyID, {
      token: tokenForUser,
    });

    if (!isValidRequest) {
      response.statusCode = 401;
      response.end(`Signature verification failed`);
      return;
    }
  } catch (error) {
    console.error("Error while verifying request", error);
    response.statusCode = 500;
    response.end(`FATAL: error while verifying request`);
    return;
  }
  console.log("Request verified");

  // Acknowledge the request
  response.write(createAckEvent().toString());
  console.log("Request acknowledged");

  // get user info
  const octokit = new Octokit({ auth: tokenForUser });
  const { data: user } = await octokit.request("GET /user");

  // get user's last message
  const input = JSON.parse(body);
  console.log(inspect(input, { depth: Infinity }));
  const lastMessage = input.messages[input.messages.length - 1];

  if (lastMessage.copilot_confirmations?.length) {
    // send text acknoledging the confirmation choice
    response.write(
      createTextEvent(
        `ok, @${user.login}, ${lastMessage.copilot_confirmations[0].state}!`
      ).toString()
    );
    console.log("Text response acknoledging the confirmation choice sent");
  } else if (/confirm/i.test(lastMessage.content)) {
    // send a confirmation message
    response.write(
      createConfirmationEvent({
        title: `Are you @${user.login}?`,
        message: "Just making sure",
        id: "1",
      }).toString()
    );
    console.log("Confirmation response sent");
  } else if (/reference/i.test(lastMessage.content)) {
    response.write(
      createTextEvent(`ok, @${user.login}, a reference is incoming:`).toString()
    );
    // send a reference
    response.write(
      createReferencesEvent([
        {
          type: "blackbeard.story",
          id: "snippet",
          data: {
            file: "story.go",
            start: "0",
            end: "13",
            content: "func main()...writeStory()...",
          },
          is_implicit: false,
          metadata: {
            display_name: "Lines 1-13 from story.go",
            display_icon: "icon",
            display_url: "http://blackbeard.com/story/1",
          },
        },
      ]).toString()
    );
    console.log("Reference response sent");
  } else if (/error/i.test(lastMessage.content)) {
    response.write(
      createTextEvent(`ok, @${user.login}, here are some errors:`).toString()
    );
    // send errors
    const referenceError = {
      type: "reference",
      code: "1",
      message: "test reference error",
      identifier: "reference-identifier",
    };
    const functionError = {
      type: "function",
      code: "1",
      message: "test function error",
      identifier: "function-identifier",
    };
    const agentError = {
      type: "agent",
      code: "1",
      message: "test agent error",
      identifier: "agent-identifier",
    };
    response.write(
      // @ts-expect-error
      createErrorsEvent([referenceError, functionError, agentError]).toString()
    );
    console.log("Confirmation response sent");
  } else {
    // send a text message
    response.write(createTextEvent(`Hello, @${user.login}!`).toString());
    console.log("Text response sent");
  }

  // close the connection
  response.end(createDoneEvent().toString());

  console.log("Socket closed");
});

server.listen(3000);
console.log("listening at http://localhost:3000");

function getBody(request) {
  return new Promise((resolve) => {
    const bodyParts = [];
    let body;
    request
      .on("data", (chunk) => {
        bodyParts.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(bodyParts).toString();
        resolve(body);
      });
  });
}

function createAckEvent() {
  return {
    data: {
      choices: [
        {
          delta: { content: ``, role: "assistant" },
        },
      ],
    },
    toString() {
      return `data: ${JSON.stringify(this.data)}\n\n`;
    },
  };
}

/**
 * @param {string} message
 * @returns {import('./types').ResponseEvent<"text">}
 */
function createTextEvent(message) {
  return {
    data: {
      choices: [
        {
          delta: { content: message, role: "assistant" },
        },
      ],
    },
    toString() {
      return `data: ${JSON.stringify(this.data)}\n\n`;
    },
  };
}

/**
 * @param {import('./types').CreateConfirmationEventOptions} options
 * @returns {import('./types').ResponseEvent<"copilot_confirmation">}
 */
function createConfirmationEvent({ id, title, message, metadata }) {
  return {
    event: "copilot_confirmation",
    data: {
      type: "action",
      title,
      message,
      confirmation: { id, ...metadata },
    },
    toString() {
      return `event: ${this.event}\ndata: ${JSON.stringify(this.data)}\n\n`;
    },
  };
}

/**
 * @param {import('./types').CopilotReference[]} references
 * @returns {import('./types').ResponseEvent<"copilot_references">}
 */
function createReferencesEvent(references) {
  return {
    event: "copilot_references",
    data: references,
    toString() {
      return `event: ${this.event}\ndata: ${JSON.stringify(this.data)}\n\n`;
    },
  };
}

/**
 * @param {import('./types').CopilotError[]} errors
 * @returns {import('./types').ResponseEvent<"copilot_errors">}
 */
function createErrorsEvent(errors) {
  return {
    event: "copilot_errors",
    data: errors,
    toString() {
      return `event: ${this.event}\ndata: ${JSON.stringify(this.data)}\n\n`;
    },
  };
}

function createDoneEvent() {
  return {
    data: {
      choices: [
        {
          finish_reason: "stop",
          delta: { content: null },
        },
      ],
    },
    toString() {
      return `data: ${JSON.stringify(this.data)}\n\ndata: [DONE]\n\n`;
    },
  };
}
