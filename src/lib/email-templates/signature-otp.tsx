import * as React from 'react'
import {
  Body,
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
  code?: string
  offerNumber?: string
}

const Email = ({ code, offerNumber }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Din engångskod för signering: ${code ?? ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Din engångskod</Heading>
        <Text style={text}>
          Använd koden nedan för att signera offert <b>{offerNumber ?? ''}</b>. Koden är giltig i 15
          minuter.
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code ?? ''}</Text>
        </Section>
        <Text style={small}>
          Om du inte begärt denna kod kan du ignorera detta meddelande.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `Engångskod för signering: ${data?.code ?? ''}`.trim(),
  displayName: 'Signering – engångskod',
  previewData: { code: '482913', offerNumber: '2026-2025' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '22px', margin: '0 0 12px' }
const small = { fontSize: '12px', color: '#666', lineHeight: '19px', margin: '12px 0 0' }
const codeBox = {
  border: '1px solid #e5e5e5',
  borderRadius: '6px',
  padding: '18px',
  textAlign: 'center' as const,
  margin: '16px 0',
}
const codeText = {
  fontSize: '32px',
  letterSpacing: '8px',
  fontWeight: 'bold' as const,
  color: '#000',
  margin: 0,
}
