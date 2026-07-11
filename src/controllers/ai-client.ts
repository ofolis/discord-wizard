import { AppEnvironment } from "../app-environment";
import { Log } from "../core";

type UnknownRecord = Record<string, unknown>;

export class AiClient {
  private static readonly __maxOutputTokens: number = 600;

  private static readonly __requestTimeoutMilliseconds: number = 45_000;

  public static async generateResponse(prompt: string): Promise<string> {
    const url: string = "https://api.openai.com/v1/responses";
    const abortController: AbortController = new AbortController();
    const timeout: NodeJS.Timeout = setTimeout(() => {
      abortController.abort();
    }, this.__requestTimeoutMilliseconds);
    const requestBody: UnknownRecord = {
      input: prompt,
      prompt: {
        id: AppEnvironment.config.openAiPromptId,
      },
      ...Object.fromEntries([["max_output_tokens", this.__maxOutputTokens]]),
      ...this.__buildModelOptions(),
    };
    Log.info("Requesting OpenAI response.", {
      hasModelOverride: AppEnvironment.config.openAiModel.length > 0,
      maxOutputTokens: this.__maxOutputTokens,
      promptLength: prompt.length,
    });
    const response: Response = await this.__fetchWithTimeout(
      url,
      {
        body: JSON.stringify(requestBody),
        headers: new Headers([
          ["Authorization", `Bearer ${AppEnvironment.config.openAiApiKey}`],
          ["Content-Type", "application/json"],
        ]),
        method: "POST",
        signal: abortController.signal,
      },
      timeout,
    );
    if (!response.ok) {
      Log.throw("OpenAI response request failed.", {
        body: await response.text(),
        status: response.status,
        statusText: response.statusText,
      });
    }
    const responseBody: unknown = await response.json();
    const content: string | undefined = this.__getResponseText(responseBody);
    Log.info(
      "OpenAI response received.",
      this.__summarizeResponse(responseBody),
    );
    if (content === undefined || content.trim().length === 0) {
      Log.throw("OpenAI response did not include output text.", {
        responseSummary: this.__summarizeResponse(responseBody),
        responseBody,
      });
    }
    return content.trim();
  }

  private static __buildModelOptions(): Record<string, string> {
    const model: string = AppEnvironment.config.openAiModel;
    if (model.length === 0) {
      return {};
    }
    return {
      model,
    };
  }

  private static __collectContentText(contentItems: unknown[]): string[] {
    const textValues: string[] = [];
    contentItems.forEach(contentItem => {
      if (!this.__isRecord(contentItem)) {
        return;
      }
      const text: unknown = contentItem.text;
      if (typeof text === "string" && text.length > 0) {
        textValues.push(text);
      }
    });
    return textValues;
  }

  private static async __fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeout: NodeJS.Timeout,
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } finally {
      clearTimeout(timeout);
    }
  }

  private static __getOutputItems(response: unknown): unknown[] {
    if (!this.__isRecord(response) || !Array.isArray(response.output)) {
      return [];
    }
    return response.output;
  }

  private static __getOutputTypes(response: unknown): string[] {
    return this.__getOutputItems(response).flatMap(outputItem => {
      if (!this.__isRecord(outputItem)) {
        return [];
      }
      const outputType: unknown = outputItem.type;
      if (typeof outputType !== "string") {
        return [];
      }
      return [outputType];
    });
  }

  private static __getResponseText(response: unknown): string | undefined {
    if (this.__isRecord(response) && typeof response.output_text === "string") {
      return response.output_text;
    }
    const textValues: string[] = [];
    this.__getOutputItems(response).forEach(outputItem => {
      if (!this.__isRecord(outputItem) || !Array.isArray(outputItem.content)) {
        return;
      }
      textValues.push(...this.__collectContentText(outputItem.content));
    });
    if (textValues.length === 0) {
      return undefined;
    }
    return textValues.join("\n").trim();
  }

  private static __isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
  }

  private static __summarizeResponse(
    response: unknown,
  ): Record<string, unknown> {
    if (!this.__isRecord(response)) {
      return {
        responseType: typeof response,
      };
    }
    const text: string | undefined = this.__getResponseText(response);
    return {
      error: response.error,
      id: response.id,
      incompleteDetails: response.incomplete_details,
      model: response.model,
      outputTextLength: text?.length ?? 0,
      outputTypes: this.__getOutputTypes(response),
      status: response.status,
      usage: response.usage,
    };
  }
}
