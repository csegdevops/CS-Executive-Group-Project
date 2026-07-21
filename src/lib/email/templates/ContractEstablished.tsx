import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  jobTitle: string
  candidateName: string
  startDate: string
  jobUrl: string
}

export function ContractEstablishedEmail({ jobTitle, candidateName, startDate, jobUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Contract established: {candidateName} for {jobTitle}</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Contract established</Heading>
          <Text>
            <strong>{candidateName}</strong> has been placed for <strong>{jobTitle}</strong>, starting <strong>{startDate}</strong>.
          </Text>
          <Button href={jobUrl}>View job</Button>
        </Container>
      </Body>
    </Html>
  )
}
