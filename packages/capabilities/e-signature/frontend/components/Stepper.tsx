import * as React from 'react';

export interface StepperStep {
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="esig-stepper">
      {steps.map((step, i) => {
        const completed = i < currentStep;
        const active = i === currentStep;
        const stateClass = completed ? 'completed' : active ? 'active' : '';
        return (
          <React.Fragment key={i}>
            <div className={`esig-stepper-step ${stateClass}`}>
              <div className="esig-stepper-circle">{i + 1}</div>
              <div className="esig-stepper-label">{step.label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`esig-stepper-line ${completed ? 'completed' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
