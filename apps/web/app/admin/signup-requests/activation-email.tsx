"use client";

import type { SignupActivationIssueResponse } from '../../../services/signup-requests';

export type ActivationEmailResult = SignupActivationIssueResponse['activation_email'];

/** 다시 보내도 해결되지 않는 발송 실패는 운영자가 고칠 곳을 알려 준다. */
const SEND_FAILURE_REASON: Record<string, string> = {
  member_not_active: '회원 상태가 활성이 아닙니다. 회원 관리에서 상태를 확인하세요.',
  activation_member_missing: '연결된 회원 정보를 찾을 수 없습니다. 회원 관리에서 확인하세요.',
  email_recipient_missing:
    '회원 정보에 이메일 주소가 없습니다. 회원 관리에서 이메일을 입력한 뒤 재발급하세요.',
  email_not_configured: '메일 발송 설정이 되어 있지 않습니다. 링크·안내문구를 복사해 전달하세요.',
};

/** 회원 이메일이 바뀌어 이 카드의 링크를 더 쓸 수 없는 상태. 재발급만 안내한다. */
export const LINK_OUTDATED = 'activation_link_outdated';

/** 이 카드의 링크로 다시 보내 봐야 소용없는 실패(회원 정보를 고친 뒤 재발급해야 한다). */
export const RESEND_USELESS = new Set([
  'member_not_active',
  'activation_member_missing',
  'email_recipient_missing',
]);

/** 수동 발송이 이 코드로 거절되면 카드의 주소·성공 표시가 더는 맞지 않는다. */
export function isCardBlockingSendFailure(code: string): boolean {
  return code === LINK_OUTDATED || RESEND_USELESS.has(code);
}

function sendFailureReason(email: ActivationEmailResult): string | undefined {
  return email.error_code ? SEND_FAILURE_REASON[email.error_code] : undefined;
}

/** 발송 실패 뒤 운영자가 할 일. 배너와 카드가 같은 안내를 쓴다. */
function sendFailureAction(email: ActivationEmailResult): string {
  return (
    sendFailureReason(email) ?? '아래에서 다시 보내거나 링크·안내문구를 복사해 전달하세요.'
  );
}

/** 승인 직후 자동 발송 결과를 운영자 피드백으로 바꾼다. 실패해도 승인은 완료 상태다. */
export function approveFeedback(email: ActivationEmailResult): {
  tone: 'success' | 'error';
  message: string;
} {
  if (email.status === 'sent') {
    return {
      tone: 'success',
      message: `가입신청을 승인했고 ${email.sent_to ?? '신청 이메일'}으로 안내 메일을 보냈습니다.`,
    };
  }
  return {
    tone: 'error',
    message:
      `승인은 완료됐지만 안내 메일을 보내지 못했습니다. ${sendFailureAction(email)}`,
  };
}

/** 재발급 직후 자동 발송 결과를 운영자 피드백으로 바꾼다. 실패해도 새 토큰은 유효하다. */
export function reissueFeedback(email: ActivationEmailResult): {
  tone: 'success' | 'error';
  message: string;
} {
  if (email.status === 'sent') {
    return {
      tone: 'success',
      message: `활성화 토큰을 재발급했고 ${email.sent_to ?? '신청 이메일'}으로 안내 메일을 보냈습니다.`,
    };
  }
  return {
    tone: 'error',
    message:
      `토큰은 재발급됐지만 안내 메일을 보내지 못했습니다. ${sendFailureAction(email)}`,
  };
}

export function ActivationEmailStatus({ email }: { email: ActivationEmailResult }) {
  if (email.status === 'sent') {
    return (
      <p className="text-sm text-state-success">
        안내 메일을 보냈습니다. 받지 못했다면 다시 보내거나 링크·안내문구를 복사해 전달하세요.
      </p>
    );
  }
  const reason = sendFailureReason(email);
  return (
    <p className="text-sm text-state-error">
      안내 메일을 보내지 못했습니다. {reason ?? '다시 보내거나 링크·안내문구를 복사해 전달하세요.'}
    </p>
  );
}

export function sendFailureCode(email: ActivationEmailResult): string {
  return email.status === 'failed' ? (email.error_code ?? '') : '';
}

export function OutdatedLinkNotice({ name, studentId }: { name: string; studentId: string }) {
  return (
    <div className="space-y-2 rounded border border-state-error bg-white p-4" role="alert">
      <p className="text-sm font-medium text-state-error">
        {name} ({studentId}) 회원의 이메일이 바뀌어 이전에 발급한 링크는 더 쓸 수 없습니다.
      </p>
      <p className="text-sm text-text-primary">
        목록에서 이 신청의 &lsquo;재발급·메일 발송&rsquo;을 눌러 새 링크를 보내세요.
      </p>
    </div>
  );
}
