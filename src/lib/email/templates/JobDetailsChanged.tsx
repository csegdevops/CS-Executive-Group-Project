import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  jobTitle: string
  field: string
  oldValue: string
  newValue: string
  jobUrl: string
}

export function JobDetailsChangedEmail({ jobTitle, field, oldValue, newValue, jobUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{jobTitle}: {field} changed to {newValue}</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Job {field} updated</Heading>
          <Text>
            <strong>{jobTitle}</strong>&apos;s {field} changed from <strong>{oldValue}</strong> to <strong>{newValue}</strong>.
          </Text>
          <Button href={jobUrl}>View job</Button>
        </Container>
      </Body>
    </Html>
  )
}
