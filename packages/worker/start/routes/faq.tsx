/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FaqRoute } from '../pages/faq.tsx'

export const Route = createFileRoute('/faq')({ component: FaqRoute })
