import * as React from 'react'
import { Body, Button, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

// Renderar bara Vidar-godkänd text (bodyText, från app_settings.review_request_config.template,
// se review-requests.server.ts) + en knapp till Google-recensionen. Skriver aldrig egen
// marknadsföringstext - Agent - Innehåll äger utkastet, Vidar godkänner det.

interface Props {
  customerName?: string
  reviewUrl?: string
  bodyText?: string
}

const Email = ({ customerName, reviewUrl, bodyText }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Vad tyckte du om ditt takbyte?</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={text}>
          {bodyText || `Hej${customerName ? ' ' + customerName : ''}! Tack för att du valde RoslagsTak.`}
        </Text>
        <Section style={{ margin: '20px 0' }}>
          <Button href={reviewUrl ?? '#'} style={button}>
            Lämna ett omdöme på Google
          </Button>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Vad tyckte du om ditt takbyte?',
  displayName: 'Omdömesförfrågan',
  previewData: {
    customerName: 'Anna Andersson',
    reviewUrl: 'https://g.page/r/example/review',
    bodyText: '[Vidar-godkänd text från app_settings.review_request_config.template]',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '22px', margin: '0 0 12px' }
const button = {
  backgroundColor: '#000',
  color: '#fff',
  padding: '12px 22px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
}
