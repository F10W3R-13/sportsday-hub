import { TrashView } from '@/components/trash/trash-view'

export default async function TrashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">휴지통</h1>
        <p className="text-sm text-muted-foreground">
          삭제된 항목을 30일 내에 복원할 수 있습니다.
        </p>
      </div>
      <TrashView />
    </div>
  )
}
