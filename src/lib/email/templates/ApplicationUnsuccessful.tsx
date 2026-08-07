import { Html, Head, Body, Container, Heading, Text, Preview } from "@react-email/components"

interface Props {
  candidateName: string
  jobTitle: string
  companyName: string
}

export function ApplicationUnsuccessfulEmail({ candidateName, jobTitle, companyName }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Update on your application for {jobTitle}</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Thank you for your application</Heading>
          <Text>Dear {candidateName},</Text>
          <Text>
            Thank you for your interest in the <strong>{jobTitle}</strong> role at <strong>{companyName}</strong> and
            for taking the time to apply. After careful consideration, we&apos;ve decided to move forward with other
            candidates for this position.
          </Text>
          <Text>
            We appreciate the effort you put into your application and encourage you to apply for future roles that
            match your skills and experience.
          </Text>
          <Text>Kind regards</Text>
        </Container>
      </Body>
    </Html>
  )
}
