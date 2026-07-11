import { type TranslationKey } from '@/i18n'
import {
  IconTelegram,
  IconNotion,
  IconFigma,
  IconTrello,
  IconSlack,
  IconZoom,
  IconStripe,
  IconGmail,
  IconMedium,
  IconSkype,
  IconDocker,
  IconGithub,
  IconGitlab,
  IconDiscord,
  IconWhatsapp,
} from '@/assets/brand-icons'

// `desc` fields hold translation KEYS — t() is called at render (G2). Brand
// `name` stays literal (product name). `logo` is JSX evaluated once.
export const apps: {
  name: string
  logo: React.ReactNode
  connected: boolean
  desc: TranslationKey
}[] = [
  {
    name: 'Telegram',
    logo: <IconTelegram />,
    connected: false,
    desc: 'apps.desc.telegram',
  },
  {
    name: 'Notion',
    logo: <IconNotion />,
    connected: true,
    desc: 'apps.desc.notion',
  },
  {
    name: 'Figma',
    logo: <IconFigma />,
    connected: true,
    desc: 'apps.desc.figma',
  },
  {
    name: 'Trello',
    logo: <IconTrello />,
    connected: false,
    desc: 'apps.desc.trello',
  },
  {
    name: 'Slack',
    logo: <IconSlack />,
    connected: false,
    desc: 'apps.desc.slack',
  },
  {
    name: 'Zoom',
    logo: <IconZoom />,
    connected: true,
    desc: 'apps.desc.zoom',
  },
  {
    name: 'Stripe',
    logo: <IconStripe />,
    connected: false,
    desc: 'apps.desc.stripe',
  },
  {
    name: 'Gmail',
    logo: <IconGmail />,
    connected: true,
    desc: 'apps.desc.gmail',
  },
  {
    name: 'Medium',
    logo: <IconMedium />,
    connected: false,
    desc: 'apps.desc.medium',
  },
  {
    name: 'Skype',
    logo: <IconSkype />,
    connected: false,
    desc: 'apps.desc.skype',
  },
  {
    name: 'Docker',
    logo: <IconDocker />,
    connected: false,
    desc: 'apps.desc.docker',
  },
  {
    name: 'GitHub',
    logo: <IconGithub />,
    connected: false,
    desc: 'apps.desc.github',
  },
  {
    name: 'GitLab',
    logo: <IconGitlab />,
    connected: false,
    desc: 'apps.desc.gitlab',
  },
  {
    name: 'Discord',
    logo: <IconDiscord />,
    connected: false,
    desc: 'apps.desc.discord',
  },
  {
    name: 'WhatsApp',
    logo: <IconWhatsapp />,
    connected: false,
    desc: 'apps.desc.whatsapp',
  },
]
