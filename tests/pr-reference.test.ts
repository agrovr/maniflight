import { describe, expect, it } from "vitest";
import { parsePullRequestReference } from "../src/pr/reference.js";

describe("pull request shorthand", () => {
  it("parses only owner/repository#number references", () => {
    expect(parsePullRequestReference("rtk-ai/rtk#3114")).toEqual({
      owner: "rtk-ai",
      repo: "rtk",
      number: 3114,
      repository: "rtk-ai/rtk",
    });
    expect(parsePullRequestReference("agrovr/maniflight.cli#1")).toEqual({
      owner: "agrovr",
      repo: "maniflight.cli",
      number: 1,
      repository: "agrovr/maniflight.cli",
    });
  });

  it.each([
    "https://github.com/rtk-ai/rtk/pull/3114",
    "github.com/rtk-ai/rtk#3114",
    "rtk-ai/rtk/pulls#3114",
    "../rtk#3114",
    "rtk-ai/../rtk#3114",
    "rtk-ai\\rtk#3114",
    "rtk-ai/rtk#3114/extra",
    "rtk-ai/rtk#1#2",
    "rtk-ai/rtk",
  ])("rejects URL and path-like input: %s", (value) => {
    expect(() => parsePullRequestReference(value)).toThrow();
  });

  it.each([
    " rtk-ai/rtk#3114",
    "rtk-ai/rtk#3114 ",
    "rtk-ai/rtk#0",
    "rtk-ai/rtk#-1",
    "rtk-ai/rtk#01",
    "rtk-ai/rtk#1.5",
    "rtk-ai/rtk#9007199254740992",
    "rtk-ai/rtk\n#3114",
    "rtk-ai/rtk#31\u001b14",
    "rtk-ai/rtk\u202e#3114",
  ])("rejects ambiguous, unsafe, or invalid shorthand: %s", (value) => {
    expect(() => parsePullRequestReference(value)).toThrow();
  });
});
