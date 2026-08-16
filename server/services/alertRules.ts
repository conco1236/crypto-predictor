export type AlertRuleScope = { symbol: string; exchange: string; interval: string };
export type AlertRule = AlertRuleScope & { alertThreshold: number; enabled: number };
export type TelegramDefaults = { alertThreshold: number; enabled: number; botToken: string; chatId: string };

const scoreScope = (rule: AlertRule, scope: AlertRuleScope) =>
  (rule.symbol === scope.symbol ? 4 : rule.symbol === "*" ? 0 : -100) +
  (rule.exchange === scope.exchange ? 2 : rule.exchange === "*" ? 0 : -100) +
  (rule.interval === scope.interval ? 1 : rule.interval === "*" ? 0 : -100);

export function resolveAlertRule(defaults: TelegramDefaults, rules: AlertRule[], scope: AlertRuleScope) {
  const matches = rules.filter(rule => scoreScope(rule, scope) >= 0).sort((a, b) => scoreScope(b, scope) - scoreScope(a, scope));
  const selected = matches[0];
  return selected ? { ...defaults, alertThreshold: selected.alertThreshold, enabled: selected.enabled } : defaults;
}
