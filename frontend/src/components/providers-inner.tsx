'use client';

import React, { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import ContextProvider from '../../context';
import ApolloProviderClient from '@/components/apollo-client-provider';

export default function ProvidersInner({ children }: { children: ReactNode }) {
  return (
    <ApolloProviderClient>
      <ContextProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </ContextProvider>
    </ApolloProviderClient>
  );
}
