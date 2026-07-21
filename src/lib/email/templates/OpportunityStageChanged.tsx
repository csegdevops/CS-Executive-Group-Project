import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  opportunityTitle: string
  oldStage: string
  newStage: string
  opportunityUrl: string
}

export function OpportunityStageChangedEmail({ opportunityTitle, oldStage, newStage, opportunityUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{opportunityTitle} moved to {newStage}</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Opportunity stage updated</Heading>
          <Text>
            <strong>{opportunityTitle}</strong> moved from <strong>{oldStage}</strong> to <strong>{newStage}</strong>.
          </Text>
          <Button href={opportunityUrl}>View opportunity</Button>
        </Container>
      </Body>
    </Html>
  )
}
