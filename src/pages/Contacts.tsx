import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { contactsApi } from '@/lib/api';
import { Plus, Search, Upload, MoreVertical, Phone, Mail, Tag, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Contacts() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      // Modo demo: dados mock
      const token = localStorage.getItem('auth_token');
      if (token === 'mock_token_123') {
        const mockContacts = [
          {
            id: '1',
            name: 'João Silva',
            phone_e164: '+5511999887766',
            email: 'joao@email.com',
            tags: 'vip,ativo',
            consent_at: new Date().toISOString(),
            optout_at: null,
          },
          {
            id: '2',
            name: 'Maria Santos',
            phone_e164: '+5521988776655',
            email: 'maria@email.com',
            tags: 'novo',
            consent_at: new Date().toISOString(),
            optout_at: null,
          },
          {
            id: '3',
            name: 'Pedro Oliveira',
            phone_e164: '+5531977665544',
            email: null,
            tags: 'inativo',
            consent_at: null,
            optout_at: null,
          },
          {
            id: '4',
            name: 'Ana Costa',
            phone_e164: '+5541966554433',
            email: 'ana@email.com',
            tags: 'vip,premium',
            consent_at: new Date().toISOString(),
            optout_at: null,
          },
          {
            id: '5',
            name: 'Carlos Souza',
            phone_e164: '+5551955443322',
            email: 'carlos@email.com',
            tags: null,
            consent_at: new Date().toISOString(),
            optout_at: '2024-01-15T10:00:00Z',
          },
        ];
        setContacts(mockContacts);
        setLoading(false);
        return;
      }

      const data = await contactsApi.list();
      setContacts(data);
    } catch (error) {
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone_e164?.includes(searchTerm)
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
            <p className="text-muted-foreground mt-1">Gerencie sua base de contatos e leads</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Contato
            </Button>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhum contato encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando seu primeiro contato'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.name || <span className="text-muted-foreground">Sem nome</span>}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {contact.phone_e164 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {contact.phone_e164}
                            </div>
                          )}
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              {contact.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.tags ? (
                          <div className="flex gap-1 flex-wrap">
                            {contact.tags.split(',').map((tag: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tag.trim()}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.optout_at ? (
                          <Badge variant="destructive">Opt-out</Badge>
                        ) : contact.consent_at ? (
                          <Badge variant="default" className="bg-success">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
