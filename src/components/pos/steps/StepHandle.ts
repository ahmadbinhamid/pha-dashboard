// Imperative handle shared by wizard steps whose "continue" action needs to
// run internal validation (or an async submit) before the parent advances —
// exposed via forwardRef so the page header's Next/Create button can trigger
// it without lifting each step's validation state out of the step itself.
export interface StepHandle {
  submit: () => void;
}
