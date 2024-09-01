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
} from "@copilot-extensions/preview-sdk";

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
    }
  );

  // debug log
  // console.log(
  //   JSON.stringify(
  //     {
  //       headers: {
  //         ...request.headers,
  //         "x-github-token": "REDACTED",
  //       },
  //       body: input,
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
  response.write(createAckEvent().toString());
  console.log("Request acknowledged");

  // get user info
  const octokit = new Octokit({ auth: tokenForUser });
  const { data: user } = await octokit.request("GET /user");

  // get user's last message
  const userConfirmation = getUserConfirmation(payload);
  const userMessage = getUserMessage(payload);

  if (userConfirmation) {
    // send text acknoledging the confirmation choice
    response.write(
      createTextEvent(
        `ok, @${user.login}, ${
          userConfirmation.accepted ? "accepted" : "dismissed"
        }!`
      ).toString()
    );
    console.log(
      "Text response acknowledged the confirmation choice sent",
      userConfirmation
    );
  } else if (/confirm/i.test(userMessage)) {
    // send a confirmation message
    response.write(
      createConfirmationEvent({
        title: `Are you @${user.login}?`,
        message: "Just making sure",
        id: "1",
      }).toString()
    );
    console.log("Confirmation response sent");
  } else if (/reference/i.test(userMessage)) {
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
  } else if (/error/i.test(userMessage)) {
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
