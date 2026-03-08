declare module 'react-markdown' {
  import type { ComponentType, ReactNode } from 'react'

  interface ReactMarkdownProps {
    children: string
    className?: string
    components?: Record<string, ComponentType<any>>
  }

  const ReactMarkdown: ComponentType<ReactMarkdownProps>
  export default ReactMarkdown
}
