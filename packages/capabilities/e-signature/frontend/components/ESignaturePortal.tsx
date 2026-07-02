import * as React from 'react';
import { Stepper } from './Stepper.js';
import { ContractSelector } from './ContractSelector.js';
import { TermsReview } from './TermsReview.js';
import { SignaturePad } from './SignaturePad.js';
import { SignatureReceipt } from './SignatureReceipt.js';
import { ToastContainer, useToasts } from './Toast.js';
import { useESignatureState } from '../hooks/useESignatureState.js';
import type { ContractDefinition, Party, SignatureRecord } from '../../contracts/events.js';

const STEPPER_STEPS = [
  { label: 'Select' },
  { label: 'Review' },
  { label: 'Party A' },
  { label: 'Party B' },
  { label: 'Complete' },
];

export interface ESignaturePortalProps {
  /** Catalog of contracts the user can choose from. Pass at least one. */
  contracts: ContractDefinition[];
  /** Both parties pre-filled. */
  parties: [Party, Party];
  /** Brand label for header. */
  brand?: { name: string; subtitle: string; icon?: string };
  /** Called after a signature is locally captured. Return a Promise that resolves
   *  once the signature is persisted server-side (so the UI can show a spinner). */
  onSignatureCaptured?: (sig: SignatureRecord) => Promise<void>;
  /** Called once both signatures are captured. The receipt is shown anyway; this is for side-effects. */
  onCompleted?: (session: ReturnType<typeof useESignatureState>['session']) => void;
  ipLookupUrl?: string;
}

export function ESignaturePortal({
  contracts,
  parties,
  brand = { name: 'Ward Tech Solutions', subtitle: 'Electronic Signature Portal', icon: 'W' },
  onSignatureCaptured,
  onCompleted,
  ipLookupUrl,
}: ESignaturePortalProps) {
  const initialContract = contracts[0];
  if (!initialContract) throw new Error('ESignaturePortal: `contracts` must contain at least one contract');
  const { session, step, clientIp, selectContract, acceptTerms, goToStep, sign } = useESignatureState({
    initialContract,
    parties,
    ipLookupUrl,
  });
  const [selectedRef, setSelectedRef] = React.useState<string | null>(null);
  const [consented, setConsented] = React.useState(false);
  const { toasts, push: pushToast } = useToasts();

  React.useEffect(() => {
    if (session.status === 'completed' && onCompleted) onCompleted(session);
  }, [session, onCompleted]);

  const handleSelectContract = React.useCallback((c: ContractDefinition) => {
    setSelectedRef(c.ref);
    selectContract(c);
    pushToast('info', `${c.title} selected`);
  }, [selectContract, pushToast]);

  const handleAcceptAndProceed = React.useCallback(() => {
    acceptTerms();
    goToStep(2);
  }, [acceptTerms, goToStep]);

  const handleSign = React.useCallback(async (role: 'A' | 'B', sig: SignatureRecord) => {
    sign(role, sig);
    const partyName = parties.find((p) => p.role === role)?.fullName ?? `Party ${role}`;
    pushToast('success', `${partyName} signature confirmed`);
    if (onSignatureCaptured) {
      try { await onSignatureCaptured(sig); }
      catch (err) { pushToast('error', `Persist failed: ${(err as Error).message}`); }
    }
  }, [sign, parties, pushToast, onSignatureCaptured]);

  const dateLabel = React.useMemo(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }), []);

  return (
    <div className="esig-root">
      <div className="esig-header-bar">
        <div className="esig-brand">
          {brand.icon && <div className="esig-brand-icon">{brand.icon}</div>}
          <div>
            <h1 className="esig-brand-name">{brand.name}</h1>
            <div className="esig-brand-subtitle">{brand.subtitle}</div>
          </div>
        </div>
        <div className="esig-header-date">{dateLabel}</div>
      </div>

      <ToastContainer toasts={toasts} />

      <div className="esig-main-container">
        <Stepper steps={STEPPER_STEPS} currentStep={step} />

        {step === 0 && (
          <ContractSelector
            contracts={contracts}
            selectedRef={selectedRef}
            onSelect={handleSelectContract}
            onContinue={() => goToStep(1)}
          />
        )}

        {step === 1 && (
          <TermsReview
            contract={session.contract}
            parties={parties}
            consented={consented}
            onConsentChange={setConsented}
            onBack={() => goToStep(0)}
            onProceed={handleAcceptAndProceed}
          />
        )}

        {step === 2 && (
          <SignaturePad
            party={parties[0]}
            clientIp={clientIp}
            onBack={() => goToStep(1)}
            onConfirm={(sig) => handleSign('A', sig)}
          />
        )}

        {step === 3 && (
          <SignaturePad
            party={parties[1]}
            counterpartySignedLabel={`Party A — ${parties[0].fullName}`}
            clientIp={clientIp}
            onBack={() => goToStep(2)}
            onConfirm={(sig) => handleSign('B', sig)}
          />
        )}

        {step === 4 && (
          <SignatureReceipt session={session} />
        )}
      </div>
    </div>
  );
}
