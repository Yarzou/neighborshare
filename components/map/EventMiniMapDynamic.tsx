import dynamic from 'next/dynamic'

const EventMiniMap = dynamic(() => import('./EventMiniMap'), { ssr: false })

export default EventMiniMap
