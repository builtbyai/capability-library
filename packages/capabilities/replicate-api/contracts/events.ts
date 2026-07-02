import type { Prediction, Training } from './schemas.js';

export interface PredictionStartedEvent {
  event: 'replicate.prediction.started';
  prediction: Prediction;
  at: string;
}

export interface PredictionOutputEvent {
  event: 'replicate.prediction.output';
  prediction: Prediction;
  at: string;
}

export interface PredictionCompletedEvent {
  event: 'replicate.prediction.completed';
  prediction: Prediction;
  at: string;
}

export interface TrainingStartedEvent {
  event: 'replicate.training.started';
  training: Training;
  at: string;
}

export interface TrainingCompletedEvent {
  event: 'replicate.training.completed';
  training: Training;
  at: string;
}

export type ReplicateEvent =
  | PredictionStartedEvent
  | PredictionOutputEvent
  | PredictionCompletedEvent
  | TrainingStartedEvent
  | TrainingCompletedEvent;
