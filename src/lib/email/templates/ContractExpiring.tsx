import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  jobTitle: string
  candidateName: string
  finishDate: string
  jobUrl: string
}

export function ContractExpiringEmail({ jobTitle, candidateName, finishDate, jobUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Contract expiring: {candidateName} for {jobTitle}</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Contract expiring soon</Heading>
          <Text>
            <strong>{candidateName}</strong>&apos;s contract for <strong>{jobTitle}</strong> ends on <strong>{finishDate}</strong>.
          </Text>
          <Button href={jobUrl}>View job</Button>
        </Container>
      </Body>
    </Html>
  )
}
