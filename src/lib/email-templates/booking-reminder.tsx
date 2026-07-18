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
  greetName?: string
  bookingDate: string // formatted, human readable, sv-SE
  address?: string
  recipientType?: 'kund' | 'tilldelad' | 'admin'
  intervalLabel?: string // e.g. "om 3 dagar", "imorgon"
}

const Email = ({ greetName, bookingDate, address, recipientType, intervalLabel }: Props) => {
  const isCustomer = recipientType === 'kund'
  const heading = isCustomer ? 'Påminnelse om ditt bokade besök' : 'Påminnelse: bokat jobb'
  const intro = isCustomer
    ? `Hej${greetName ? ' ' + greetName : ''}! Detta är en påminnelse om ditt bokade besök ${intervalLabel ?? ''}.`
    : `Påminnelse: du har ett bokat jobb ${intervalLabel ?? ''}${greetName ? ' (' + greetName + ')' : ''}.`
  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>Påminnelse – {bookingDate}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={text}>{intro}</Text>
          <Section style={box}>
            <Text style={label}>Datum &amp; tid</Text>
            <Text style={value}>{bookingDate}</Text>
            {address ? (
              <>
                <Text style={label}>Adress</Text>
                <Text style={value}>{address}</Text>
              </>
            ) : null}
          </Section>
          {isCustomer ? (
            <Text style={text}>
              Om något behöver ändras, kontakta oss så snart som möjligt.
            </Text>
          ) : (
            <Text style={text}>Öppna kalendern i admin.vt6 för mer information.</Text>
          )}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Påminnelse – bokat besök ${data?.bookingDate ?? ''}`.trim(),
  displayName: 'Bokningspåminnelse',
  previewData: {
    greetName: 'Anna',
    bookingDate: 'torsdag 24 juli 2026 kl. 10:00',
    address: 'Storgatan 1, Stockholm',
    recipientType: 'kund',
    intervalLabel: 'om 3 dagar',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '22px', margin: '0 0 12px' }
const box = { border: '1px solid #e5e5e5', borderRadius: '6px', padding: '14px 16px', margin: '16px 0' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#888', letterSpacing: '0.5px', margin: '6px 0 2px' }
const value = { fontSize: '15px', color: '#000', margin: '0 0 6px', fontWeight: 500 as const }
