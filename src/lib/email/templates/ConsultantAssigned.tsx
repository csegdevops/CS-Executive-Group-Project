import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  consultationTitle: string
  companyName: string
  consultationUrl: string
}

export function ConsultantAssignedEmail({ consultationTitle, companyName, consultationUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>You've been assigned to {consultationTitle}</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>You've been assigned as consultant</Heading>
          <Text>
            You've been assigned to <strong>{consultationTitle}</strong> for <strong>{companyName}</strong>.
          </Text>
          <Button href={consultationUrl}>View consultation</Button>
        </Container>
      </Body>
    </Html>
  )
}
