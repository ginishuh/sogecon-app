import { render, screen } from '@testing-library/react';
import React from 'react';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { TextArea } from '../../components/ui/textarea';

describe('Form controls a11y', () => {
  it('Input: error sets aria-invalid and aria-describedby', () => {
    render(<Input id="email" label="이메일" errorText="필수 항목입니다" />);
    const el = screen.getByLabelText('이메일');
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(el).toHaveAttribute('aria-describedby', 'email-error');
  });

  it('Input: helperText connects via aria-describedby', () => {
    render(<Input id="nick" label="닉네임" helperText="공개 표시 이름" />);
    const el = screen.getByLabelText('닉네임');
    expect(el).not.toHaveAttribute('aria-invalid');
    expect(el).toHaveAttribute('aria-describedby', 'nick-help');
  });

  it('Select/TextArea mirror error linkage', () => {
    render(
      <div>
        <Select id="role" label="역할" errorText="선택하세요">
          <option value="">--</option>
          <option value="u">User</option>
        </Select>
        <TextArea id="bio" label="소개" errorText="너무 깁니다" />
      </div>,
    );
    expect(screen.getByLabelText('역할')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('역할')).toHaveAttribute('aria-describedby', 'role-error');
    expect(screen.getByLabelText('소개')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('소개')).toHaveAttribute('aria-describedby', 'bio-error');
  });
});

