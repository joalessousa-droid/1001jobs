import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Save, RefreshCw } from 'lucide-react'

interface FunnelTotals {
  sent: number; accepted: number; declined: number; expired: number
  pending: number; queued: number; superseded: number
  avg_response_seconds: number; conversion_rate: number
}
interface FunnelRow {
  key: string; provider_id?: string
  sent: number; accepted: number; declined: number; expired: number
  avg_response_seconds: number; conversion_rate: number
}
interface FunnelData {
  totals: FunnelTotals
  breakdown: FunnelRow[]
  group_by: string
  active_weights: any
  period: { from: string; to: string }
}
interface WeightsPreset {
  id: string; name: string; is_active: boolean; notes: string | null
  w_distance: number; w_reputation: number; w_availability: number
  w_specialization: number; w_response_time: number
  w_recurrence: number; w_anti_cancel: number
  updated_at: string
}

const FIELDS: { key: keyof WeightsPreset; label: string }[] = [
  { key: 'w_distance', label: 'Distância' },
  { key: 'w_reputation', label: 'Reputação' },
  { key: 'w_availability', label: 'Disponibilidade' },
  { key: 'w_specialization', label: 'Especialidade' },
  { key: 'w_response_time', label: 'Tempo de resposta' },
  { key: 'w_recurrence', label: 'Recorrência' },
  { key: 'w_anti_cancel', label: 'Anti-cancelamento' },
]

function defaultDateRange() {
  const to = new Date()
  const from = new Date(); from.setDate(to.getDate() - 7)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function AdminDispatchFunnel() {
  const init = defaultDateRange()
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [groupBy, setGroupBy] = useState<'overall' | 'city' | 'provider'>('city')
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(false)
  const [weights, setWeights] = useState<WeightsPreset[]>([])
  const [editing, setEditing] = useState<WeightsPreset | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: f, error } = await supabase.rpc('get_dispatch_funnel', {
      _from: new Date(from + 'T00:00:00').toISOString(),
      _to: new Date(to + 'T23:59:59').toISOString(),
      _group_by: groupBy,
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    setData(f as unknown as FunnelData)
  }, [from, to, groupBy])

  const loadWeights = useCallback(async () => {
    const { data, error } = await supabase
      .from('dispatch_match_weights').select('*')
      .order('is_active', { ascending: false })
      .order('updated_at', { ascending: false })
    if (error) { toast.error(error.message); return }
    setWeights((data ?? []) as WeightsPreset[])
    if (!editing && data?.length) setEditing(data.find((d: any) => d.is_active) ?? data[0])
  }, [editing])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadWeights() }, [loadWeights])

  const saveWeights = async () => {
    if (!editing) return
    const payload: any = { ...editing }
    delete payload.created_at
    delete payload.updated_at
    const { error } = await supabase.from('dispatch_match_weights')
      .update(payload).eq('id', editing.id)
    if (error) { toast.error(error.message); return }
    toast.success('Pesos salvos')
    loadWeights(); load()
  }

  const setActive = async (id: string) => {
    // unset all then set one (uniq index ensures only one is_active)
    await supabase.from('dispatch_match_weights').update({ is_active: false }).neq('id', id)
    const { error } = await supabase.from('dispatch_match_weights').update({ is_active: true }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Preset ativado')
    loadWeights(); load()
  }

  const totals = data?.totals
  const sumW = editing ? FIELDS.reduce((acc, f) => acc + Number(editing[f.key] ?? 0), 0) : 0

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Funil de Ofertas</h1>
        <p className="text-muted-foreground text-sm">
          KPIs de envio, aceite, recusa e expiração — agrupados por cidade ou profissional.
        </p>
      </header>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="from">De</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">Até</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Agrupar por</Label>
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
              <TabsList>
                <TabsTrigger value="overall">Total</TabsTrigger>
                <TabsTrigger value="city">Cidade</TabsTrigger>
                <TabsTrigger value="provider">Profissional</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button onClick={load} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </CardContent>
      </Card>

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            ['Enviadas', totals.sent],
            ['Aceitas', totals.accepted],
            ['Recusadas', totals.declined],
            ['Expiradas', totals.expired],
            ['Pendentes', totals.pending],
            ['Tempo médio (s)', totals.avg_response_seconds],
            ['Conversão', `${(totals.conversion_rate * 100).toFixed(1)}%`],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value as any}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && groupBy !== 'overall' && (
        <Card>
          <CardHeader><CardTitle className="text-base">
            Detalhamento por {groupBy === 'city' ? 'cidade' : 'profissional'}
          </CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{groupBy === 'city' ? 'Cidade' : 'Profissional'}</TableHead>
                  <TableHead className="text-right">Enviadas</TableHead>
                  <TableHead className="text-right">Aceitas</TableHead>
                  <TableHead className="text-right">Recusadas</TableHead>
                  <TableHead className="text-right">Expiradas</TableHead>
                  <TableHead className="text-right">Tempo médio</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.breakdown.map((r) => (
                  <TableRow key={`${r.key}-${r.provider_id ?? ''}`}>
                    <TableCell className="font-medium">{r.key}</TableCell>
                    <TableCell className="text-right">{r.sent}</TableCell>
                    <TableCell className="text-right">{r.accepted}</TableCell>
                    <TableCell className="text-right">{r.declined}</TableCell>
                    <TableCell className="text-right">{r.expired}</TableCell>
                    <TableCell className="text-right">{Number(r.avg_response_seconds).toFixed(1)}s</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.conversion_rate >= 0.3 ? 'default' : 'secondary'}>
                        {(r.conversion_rate * 100).toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {data.breakdown.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Sem dados no período.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesos do algoritmo de matching</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pesos relativos usados em <code>calculate_provider_score</code>. Apenas 1 preset ativo por vez.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {weights.map(w => (
              <Button
                key={w.id}
                variant={editing?.id === w.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditing(w)}
              >
                {w.name} {w.is_active && <Badge className="ml-2" variant="secondary">ativo</Badge>}
              </Button>
            ))}
          </div>

          {editing && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type="number" step="1" min="0"
                      value={Number(editing[f.key] ?? 0)}
                      onChange={(e) =>
                        setEditing({ ...editing, [f.key]: Number(e.target.value) } as WeightsPreset)
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Soma total: <strong>{sumW}</strong> (escala livre; o score final é proporcional).
              </p>
              <div className="flex gap-2">
                <Button onClick={saveWeights}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
                {!editing.is_active && (
                  <Button variant="outline" onClick={() => setActive(editing.id)}>Tornar ativo</Button>
                )}
              </div>
            </>
          )}

          {data?.active_weights && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              Preset ativo no momento da consulta:{' '}
              <code>{JSON.stringify(data.active_weights)}</code>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
