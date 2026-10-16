import React from 'react';
import View from './view';
import { useNavigate } from 'react-router-dom';
import NotFound from './notFound';
import Button from '../components/button';
import { pizzaService } from '../service/service';
import { Franchise, FranchiseList, Role, Store, User, UserList } from '../service/pizzaService';
import { TrashIcon } from '../icons';

interface Props {
  user: User | null;
}

export default function AdminDashboard(props: Props) {
  const navigate = useNavigate();
  const [franchiseList, setFranchiseList] = React.useState<FranchiseList>({ franchises: [], more: false });
  const [franchisePage, setFranchisePage] = React.useState(0);
  const filterFranchiseRef = React.useRef<HTMLInputElement>(null);
  const [userList, setUserList] = React.useState<UserList>({ users: [], more: false });
  const [userPage, setUserPage] = React.useState(1);
  const [userNameFilter, setUserNameFilter] = React.useState('');
  const [appliedUserNameFilter, setAppliedUserNameFilter] = React.useState('');
  const [userListError, setUserListError] = React.useState('');

  React.useEffect(() => {
    (async () => {
      setFranchiseList(await pizzaService.getFranchises(franchisePage, 3, '*'));
    })();
  }, [props.user, franchisePage]);

  React.useEffect(() => {
    if (!Role.isRole(props.user, Role.Admin)) return;

    (async () => {
      try {
        const nameFilter = appliedUserNameFilter.trim() ? `*${appliedUserNameFilter.trim()}*` : '*';
        setUserList(await pizzaService.listUsers(userPage, 10, nameFilter));
        setUserListError('');
      } catch {
        setUserListError('Unable to load users. Please try again.');
      }
    })();
  }, [props.user, userPage, appliedUserNameFilter]);

  function createFranchise() {
    navigate('/admin-dashboard/create-franchise');
  }

  async function closeFranchise(franchise: Franchise) {
    navigate('/admin-dashboard/close-franchise', { state: { franchise: franchise } });
  }

  async function closeStore(franchise: Franchise, store: Store) {
    navigate('/admin-dashboard/close-store', { state: { franchise: franchise, store: store } });
  }

  async function filterFranchises() {
    setFranchiseList(await pizzaService.getFranchises(franchisePage, 10, `*${filterFranchiseRef.current?.value}*`));
  }

  function filterUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserPage(1);
    setAppliedUserNameFilter(userNameFilter);
  }

  async function deleteUser(user: User) {
    if (!user.id) {
      setUserListError('Unable to delete a user without an ID.');
      return;
    }

    const displayName = user.name || user.email || 'this user';
    if (!window.confirm(`Delete ${displayName}? This cannot be undone.`)) return;

    try {
      await pizzaService.deleteUser(user.id);
    } catch {
      setUserListError('Unable to delete user. Please try again.');
      return;
    }

    setUserListError('');
    try {
      const nameFilter = appliedUserNameFilter.trim() ? `*${appliedUserNameFilter.trim()}*` : '*';
      const refreshedList = await pizzaService.listUsers(userPage, 10, nameFilter);
      if (refreshedList.users.length === 0 && userPage > 1) {
        setUserList({ users: [], more: false });
        setUserPage(userPage - 1);
        return;
      }
      setUserList(refreshedList);
    } catch {
      setUserList((current) => ({
        ...current,
        users: current.users.filter((listedUser) => listedUser.id !== user.id),
      }));
      setUserListError('User was deleted, but the list could not be refreshed.');
    }
  }

  let response = <NotFound />;
  if (Role.isRole(props.user, Role.Admin)) {
    response = (
      <View title="Mama Ricci's kitchen">
        <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
          <h3 className="text-neutral-100 text-xl">Franchises</h3>
          <div className="bg-neutral-100 overflow-clip my-4">
            <div className="flex flex-col">
              <div className="-m-1.5 overflow-x-auto">
                <div className="p-1.5 min-w-full inline-block align-middle">
                  <div className="overflow-hidden">
                    <table aria-label="Franchises" className="min-w-full divide-y divide-gray-200">
                      <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                        <tr>
                          {['Franchise', 'Franchisee', 'Store', 'Revenue', 'Action'].map((header) => (
                            <th key={header} scope="col" className="px-6 py-3 text-center text-xs font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      {franchiseList.franchises.map((franchise, findex) => {
                        return (
                          <tbody key={findex} className="divide-y divide-gray-200">
                            <tr className="border-neutral-500 border-t-2">
                              <td className="text-start px-2 whitespace-nowrap text-l font-mono text-orange-600">{franchise.name}</td>
                              <td className="text-start px-2 whitespace-nowrap text-sm font-normal text-gray-800" colSpan={3}>
                                {franchise.admins?.map((o) => o.name).join(', ')}
                              </td>
                              <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                                <button type="button" className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400  hover:border-orange-800 hover:text-orange-800" onClick={() => closeFranchise(franchise)}>
                                  <TrashIcon />
                                  Close
                                </button>
                              </td>
                            </tr>

                            {franchise.stores.map((store, sindex) => {
                              return (
                                <tr key={sindex} className="bg-neutral-100">
                                  <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800" colSpan={3}>
                                    {store.name}
                                  </td>
                                  <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800">{store.totalRevenue?.toLocaleString()} ₿</td>
                                  <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                                    <button type="button" className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800" onClick={() => closeStore(franchise, store)}>
                                      <TrashIcon />
                                      Close
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        );
                      })}
                      <tfoot>
                        <tr>
                          <td className="px-1 py-1">
                            <input type="text" ref={filterFranchiseRef} name="filterFranchise" placeholder="Filter franchises" className="px-2 py-1 text-sm border border-gray-300 rounded-lg" />
                            <button type="submit" className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800" onClick={filterFranchises}>
                              Submit
                            </button>
                          </td>
                          <td colSpan={4} className="text-end text-sm font-medium">
                            <button type="button" aria-label="Previous franchises page" className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300 " onClick={() => setFranchisePage(franchisePage - 1)} disabled={franchisePage <= 0}>
                              «
                            </button>
                            <button type="button" aria-label="Next franchises page" className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300" onClick={() => setFranchisePage(franchisePage + 1)} disabled={!franchiseList.more}>
                              »
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
          <h3 className="text-neutral-100 text-xl">Users</h3>
          <div className="bg-neutral-100 overflow-clip my-4">
            <div className="flex flex-col">
              <div className="-m-1.5 overflow-x-auto">
                <div className="p-1.5 min-w-full inline-block align-middle">
                  <div className="overflow-hidden">
                    <table aria-label="Users" className="min-w-full divide-y divide-gray-200">
                      <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                        <tr>
                          {['Name', 'Email', 'Role', 'Action'].map((header) => (
                            <th key={header} scope="col" className="px-6 py-3 text-center text-xs font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userList.users.map((listedUser, index) => (
                          <tr key={listedUser.id ?? listedUser.email ?? index} className="hover:bg-gray-100">
                            <td className="px-6 py-4 text-sm text-center font-medium text-gray-800">{listedUser.name}</td>
                            <td className="px-6 py-4 text-sm text-center text-gray-800">{listedUser.email}</td>
                            <td className="px-6 py-4 text-sm text-center text-gray-800">{listedUser.roles?.map(({ role }) => role).join(', ') || '—'}</td>
                            <td className="px-6 py-4 text-sm text-center">
                              <button
                                type="button"
                                aria-label={`Delete ${listedUser.name || listedUser.email || 'user'}`}
                                className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800 disabled:opacity-50"
                                onClick={() => deleteUser(listedUser)}
                                disabled={!listedUser.id}>
                                <TrashIcon />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="px-2 py-2" colSpan={3}>
                            <form className="flex items-center gap-2" onSubmit={filterUsers}>
                              <input
                                type="text"
                                name="filterUsers"
                                aria-label="Filter users by name"
                                placeholder="Filter users by name"
                                className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
                                value={userNameFilter}
                                onChange={(event) => setUserNameFilter(event.target.value)}
                              />
                              <button type="submit" className="px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800">
                                Search
                              </button>
                            </form>
                          </td>
                          <td className="px-2 py-2 text-end text-sm font-medium">
                            <span className="text-gray-800">Page {userPage}</span>
                            <button
                              type="button"
                              aria-label="Previous users page"
                              className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                              onClick={() => setUserPage(userPage - 1)}
                              disabled={userPage <= 1}>
                              «
                            </button>
                            <button
                              type="button"
                              aria-label="Next users page"
                              className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                              onClick={() => setUserPage(userPage + 1)}
                              disabled={!userList.more}>
                              »
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    {userListError && (
                      <p role="alert" className="p-3 text-sm text-red-700">
                        {userListError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <Button className="w-36 text-xs sm:text-sm sm:w-64" title="Add Franchise" onPress={createFranchise} />
        </div>
      </View>
    );
  }

  return response;
}
