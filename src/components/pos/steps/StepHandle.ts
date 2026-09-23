// Imperative handle for wizard steps whose "continue" needs internal validation/async submit first; exposed via forwardRef for the page header's Next/Create button to trigger.
export interface StepHandle {
  submit: () => void;
}
