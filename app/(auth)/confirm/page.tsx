"use client";

import SearchParamsWrapper from '@/components/auth/SearchParamsWrapper';
import ConfirmContent from '@/components/auth/ConfirmContent';

// Force dynamic rendering to prevent static generation issues with useSearchParams
export const dynamic = 'force-dynamic';

export default function ConfirmPage() {
  return (
    <SearchParamsWrapper>
      {(searchParams) => <ConfirmContent searchParams={searchParams} />}
    </SearchParamsWrapper>
  );
}