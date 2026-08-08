import { FileSpreadsheet, FileText, Presentation, File, FileType } from 'lucide-react'

const ICON_MAP: Record<string, typeof File> = {
  'application/vnd.google-apps.spreadsheet': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.google-apps.document': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/msword': FileText,
  'application/vnd.google-apps.presentation': Presentation,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': Presentation,
  'application/vnd.ms-powerpoint': Presentation,
  'application/pdf': FileType,
}

export function DriveFileIcon({ mimeType, className }: { mimeType?: string | null; className?: string }) {
  const Icon = (mimeType && ICON_MAP[mimeType]) || File
  return <Icon className={className ?? 'h-4 w-4'} />
}
