/** robots.txt: Regeln für unseren Bot bzw. "*", Allow/Disallow mit längstem Treffer, * und $. */

export const BOT_TOKEN = "kenntlich-check";

interface Rule {
  allow: boolean;
  pattern: string;
}

export interface Robots {
  isAllowed(pathAndQuery: string): boolean;
}

export const allowAll: Robots = { isAllowed: () => true };

export function parseRobots(text: string): Robots {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | undefined;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/).slice(0, 5000)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = (m[1] ?? "").toLowerCase();
    const value = (m[2] ?? "").trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      if (value !== "") current.rules.push({ allow: key === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  const ours = groups.filter((g) => g.agents.some((a) => a === BOT_TOKEN || a === "kenntlich"));
  const chosen = ours.length > 0 ? ours : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);
  if (rules.length === 0) return allowAll;
  const compiled = rules.map((r) => ({ ...r, re: toRegex(r.pattern), len: r.pattern.length }));
  return {
    isAllowed(path) {
      let best: (typeof compiled)[number] | undefined;
      for (const r of compiled) {
        if (!r.re.test(path)) continue;
        if (!best || r.len > best.len || (r.len === best.len && r.allow)) best = r;
      }
      return best ? best.allow : true;
    },
  };
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}
