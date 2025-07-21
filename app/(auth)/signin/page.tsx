"use client";

import SearchParamsWrapper from '@/components/auth/SearchParamsWrapper';
import SigninContent from '@/components/auth/SigninContent';

// Force dynamic rendering to prevent static generation issues with useSearchParams
export const dynamic = 'force-dynamic';

export default function SigninPage() {
  return (
    <SearchParamsWrapper>
      {(searchParams) => <SigninContent searchParams={searchParams} />}
    </SearchParamsWrapper>
  );
}