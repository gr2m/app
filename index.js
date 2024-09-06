// @ts-check

import { createServer } from "node:http";

import { Octokit } from "@octokit/core";
import {
  createAckEvent,
  createConfirmationEvent,
  createDoneEvent,
  createReferencesEvent,
  createTextEvent,
  createErrorsEvent,
  verifyAndParseRequest,
  getUserMessage,
  getUserConfirmation,
  getFunctionCalls,
  prompt,
} from "@copilot-extensions/preview-sdk";

const functions = [
  {
    type: /** @type {const} */ ("function"),
    function: {
      name: "get_delivery_date",
      description:
        "Get the delivery date for a customer's order. Call this whenever you need to know the delivery date, for example when a customer asks 'Where is my package'",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The customer's order ID.",
          },
        },
        required: ["order_id"],
        additionalProperties: false,
      },
    },
  },
];

// Create a local server to receive data from
const server = createServer(async (request, response) => {
  if (request.method === "GET") {
    response.statusCode = 200;
    response.end(`Hello, there!`);
    return;
  }

  const body = await getBody(request);
  const signature = String(request.headers["github-public-key-signature"]);
  const keyID = String(request.headers["github-public-key-identifier"]);
  const tokenForUser = String(request.headers["x-github-token"]);

  const { isValidRequest, payload } = await verifyAndParseRequest(
    body,
    signature,
    keyID,
    {
      token: tokenForUser,
    },
  );

  // debug log
  // console.log(
  //   JSON.stringify(
  //     {
  //       headers: {
  //         ...request.headers,
  //         "x-github-token": "REDACTED",
  //       },
  //       body: payload,
  //     },
  //     null,
  //     2
  //   )
  // );

  if (!isValidRequest) {
    response.statusCode = 401;
    response.end(`Signature verification failed`);
    return;
  }

  console.log("Request verified and parsed");

  // Acknowledge the request
  response.write(createAckEvent());
  console.log("Request acknowledged");

  // get user info
  const octokit = new Octokit({ auth: tokenForUser });
  const { data: user } = await octokit.request("GET /user");

  // get user's last message
  const userConfirmation = getUserConfirmation(payload);
  const userMessage = getUserMessage(payload);

  const result = await prompt({
    model: "gpt-4",
    token: tokenForUser,
    messages: payload.messages,
    tools: functions,
  });

  const [functionCall] = getFunctionCalls(result);

  if (functionCall) {
    // simulate function call
    const args = JSON.parse(functionCall.function.arguments);
    const functionCallResultMessage = {
      // CAPI currently does not accept `role: "function"` or `role: "tool"
      // role: "function",
      role: "system",
      content: JSON.stringify({
        order_id: args.order_id,
        delivery_date: "2024-12-24",
      }),
    };
    const result = await prompt({
      model: "gpt-4",
      token: tokenForUser,
      messages: [...payload.messages, functionCallResultMessage],
      tools: functions,
    });

    console.log(JSON.stringify(result, null, 2));

    response.write(createTextEvent(result.message.content));
  } else if (userConfirmation) {
    // send text acknoledging the confirmation choice
    response.write(
      createTextEvent(
        `ok, @${user.login}, ${
          userConfirmation.accepted ? "accepted" : "dismissed"
        }!`,
      ),
    );
    console.log(
      "Text response acknowledged the confirmation choice sent",
      userConfirmation,
    );
  } else if (/confirm/i.test(userMessage)) {
    // send a confirmation message
    response.write(
      createConfirmationEvent({
        title: `Are you @${user.login}?`,
        message: "Just making sure",
        id: "1",
      }),
    );
    console.log("Confirmation response sent");
  } else if (/reference/i.test(userMessage)) {
    response.write(
      createTextEvent(`ok, @${user.login}, a reference is incoming:`),
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
      ]),
    );
    console.log("Reference response sent");
  } else if (/error/i.test(userMessage)) {
    response.write(
      createTextEvent(`ok, @${user.login}, here are some errors:`),
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
      createErrorsEvent([referenceError, functionError, agentError]),
    );
    console.log("Confirmation response sent");
  } else {
    // send a text message
    response.write(createTextEvent(result.message.content));
    console.log("Text response sent");
  }

  // close the connection
  response.end(createDoneEvent());
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
