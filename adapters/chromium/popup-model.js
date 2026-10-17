import {matchesPattern, resolveRule} from "./rules.js";

// A page shortcut must never pretend to disable loading while a matching
// multi-page rule would immediately take over. Manage that scope in the list.
export function pageRuleContext(rules, address) {
  if (!address) return {managed:false};
  const exact = rules.find(rule => rule.pattern === address);
  const effective = resolveRule(rules,address);
  const managedRule = resolveRule(rules.filter(rule => rule.pattern !== address && matchesPattern(rule.pattern,address)),address);
  return {exact,effective,managed:Boolean(managedRule),managedRule};
}
