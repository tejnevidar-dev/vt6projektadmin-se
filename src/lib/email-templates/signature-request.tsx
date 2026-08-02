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
  customerName?: string
  offerNumber?: string
  signUrl?: string
  companySigner?: string
  amount?: string
}

const Email = ({ customerName, offerNumber, signUrl, companySigner, amount }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Offert ${offerNumber ?? ''} är klar för signering`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Din offert är klar för signering</Heading>
        <Text style={text}>
          Hej{customerName ? ' ' + customerName : ''}! Offert <b>{offerNumber}</b> är signerad av{' '}
          {companySigner || 'RoslagsTak'} och väntar nu på din signatur.
        </Text>
        <Section style={box}>
          <Text style={label}>Offertnummer</Text>
          <Text style={value}>{offerNumber}</Text>
          {amount ? (
            <>
              <Text style={label}>Belopp</Text>
              <Text style={value}>{amount}</Text>
            </>
          ) : null}
        </Section>
        <Section style={{ margin: '20px 0' }}>
          <Button href={signUrl ?? '#'} style={button}>
            Öppna och signera offerten
          </Button>
        </Section>
        <Text style={small}>
          Du får en engångskod till din e-post innan du signerar. När båda parter har signerat får du
          en kopia av det färdiga dokumentet.
        </Text>
        <Text style={small}>Länk: {signUrl}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Offert ${data?.offerNumber ?? ''} – klar för signering`.trim(),
  displayName: 'Offert för signering',
  previewData: {
    customerName: 'Anna Andersson',
    offerNumber: '2026-2025',
    signUrl: 'https://vt6projektadmin.se/signera/abc123',
    companySigner: 'Viktor Törnqvist',
    amount: '184 500 kr',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '22px', margin: '0 0 12px' }
const small = { fontSize: '12px', color: '#666', lineHeight: '19px', margin: '0 0 8px', wordBreak: 'break-all' as const }
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
