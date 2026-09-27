import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  offerNumber?: string
  documentUrl?: string
  customerName?: string
  companySigner?: string
  isInternal?: boolean
  docLabel?: string
  companyFallback?: string
}

const Email = ({
  recipientName,
  offerNumber,
  documentUrl,
  customerName,
  companySigner,
  isInternal,
  docLabel,
  companyFallback,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`${docLabel ?? 'Offert'} ${offerNumber ?? ''} är signerad av båda parter`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{docLabel === 'Ramavtal' ? 'Ramavtalet är signerat' : 'Offerten är signerad'}</Heading>
        <Text style={text}>
          {isInternal
            ? `${customerName ?? 'Kunden'} har signerat ${(docLabel ?? 'offert').toLowerCase()} ${offerNumber ?? ''}. Dokumentet är nu undertecknat av båda parter.`
            : `Hej${recipientName ? ' ' + recipientName : ''}! Tack – ${(docLabel ?? 'offert').toLowerCase()} ${offerNumber ?? ''} är nu signerad av både dig och ${companySigner || companyFallback || 'RoslagsTak'}.`}
        </Text>
        <Section style={box}>
          <Text style={label}>{docLabel === 'Ramavtal' ? 'Dokument' : 'Offertnummer'}</Text>
          <Text style={value}>{offerNumber ?? ''}</Text>
          <Text style={label}>Parter</Text>
          <Text style={value}>
            {companySigner || companyFallback || 'RoslagsTak'} &amp; {customerName ?? 'Kund'}
          </Text>
        </Section>
        <Section style={{ margin: '20px 0' }}>
          <Button href={documentUrl ?? '#'} style={button}>
            Hämta signerat dokument
          </Button>
        </Section>
        <Text style={small}>Länk: {documentUrl}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${data?.docLabel ?? 'Offert'} ${data?.offerNumber ?? ''} – signerad av båda parter`.trim(),
  displayName: 'Signerad offert',
  previewData: {
    recipientName: 'Anna',
    offerNumber: '2026-2025',
    documentUrl: 'https://vt6projektadmin.se/signera/abc123',
    customerName: 'Anna Andersson',
    companySigner: 'Viktor Törnqvist',
    isInternal: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '22px', margin: '0 0 12px' }
const small = { fontSize: '12px', color: '#666', lineHeight: '19px', margin: '0', wordBreak: 'break-all' as const }
const box = { border: '1px solid #e5e5e5', borderRadius: '6px', padding: '14px 16px', margin: '16px 0' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#888', letterSpacing: '0.5px', margin: '6px 0 2px' }
const value = { fontSize: '15px', color: '#000', margin: '0 0 6px', fontWeight: 500 as const }
const button = {
  backgroundColor: '#000',
  color: '#fff',
  padding: '12px 22px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
}
