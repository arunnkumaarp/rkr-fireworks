import { InfoPage } from '@/components/info-page';

export default function SafetyScreen() {
  return (
    <InfoPage
      title="Safety guide"
      intro="Crackers are fun when everyone goes home with all ten fingers. Read this with your family before Diwali."
      sections={[
        {
          heading: 'Before you light',
          body: [
            'An adult should light every cracker. Children use sparklers and ground items only with an adult beside them.',
            'Keep a bucket of water and a bucket of sand within reach. Wear cotton clothes and footwear; avoid loose silk and synthetics.',
            'Read the instructions printed on each box and follow the safe distance it gives.',
          ],
        },
        {
          heading: 'While lighting',
          body: [
            'Light crackers in an open space, away from buildings, vehicles, dry leaves and anything that can catch fire.',
            'Light at arm’s length with an agarbathi or long sparkler, then step back at once. Never lean over a cracker.',
            'Never light crackers in your hand, inside a tin or bottle, or indoors. Light rockets only from a stable bottle pointing at open sky.',
          ],
        },
        {
          heading: 'If a cracker does not go off',
          body: [
            'Do not go back to it or try to relight it. Wait at least 15 minutes, then pour water over it.',
            'Soak used sparklers and spent crackers in water before throwing them away.',
          ],
        },
        {
          heading: 'Burns and injuries',
          body: [
            'For a burn, hold it under cool running water for 15–20 minutes. Do not apply ice, toothpaste or oil.',
            'For an eye injury, do not rub or wash the eye; cover it lightly and go to a hospital at once. Emergency: dial 108 or 112.',
          ],
        },
        {
          heading: 'Storage and local rules',
          body: [
            'Store crackers in a cool, dry place away from the kitchen, gas cylinders and children’s reach.',
            'Follow the timings and rules on green crackers set by the courts and your local authorities, and be kind to animals, older people and patients nearby.',
          ],
        },
      ]}
    />
  );
}
