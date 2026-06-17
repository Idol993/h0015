<template>
  <div class="min-h-screen bg-slate-50 p-4 md:p-6">
    <div class="max-w-[1600px] mx-auto">
      <div class="bg-white rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-slate-800">社区诊所 · 前台工作台</h1>
            <div class="text-sm text-slate-500 flex items-center gap-2">
              <span>{{ currentDate }}</span>
              <span :class="store.wsConnected ? 'text-green-500' : 'text-red-500'">● {{ store.wsConnected ? '已连接' : '断开' }}</span>
              <button @click="store.fetchAllData()" class="text-blue-500 hover:text-blue-600 ml-2 text-xs">[刷新]</button>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="/lobby" target="_blank" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200">
            大厅屏 →
          </a>
          <a v-for="room in store.rooms.slice(0, 4)" :key="room.id"
             :href="`/room/${room.id}`" target="_blank"
             class="px-3 py-2 rounded-lg text-xs bg-slate-100 text-slate-700 hover:bg-slate-200">
            {{ room.name }}
          </a>
          <button @click="handleExport" class="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900">
            导出今日 CSV
          </button>
        </div>
      </div>

      <div v-if="store.dashboard" class="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-slate-800 text-lg">📊 今日概览</h2>
          <div class="text-xs text-slate-400">点击数字可筛选列表</div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-slate-500 text-xs">
                <th class="text-left py-2 px-2 font-medium sticky left-0 bg-white z-10">科室</th>
                <th class="py-2 px-2 font-medium text-center">已签到</th>
                <th class="py-2 px-2 font-medium text-center text-slate-600">候诊</th>
                <th class="py-2 px-2 font-medium text-center text-blue-600">就诊中</th>
                <th class="py-2 px-2 font-medium text-center text-green-600">完成</th>
                <th class="py-2 px-2 font-medium text-center text-red-500">过号</th>
                <th class="py-2 px-2 font-medium text-center text-purple-600">待激活</th>
                <th class="py-2 px-2 font-medium text-center text-slate-700 border-l border-slate-200">总接诊</th>
                <th class="py-2 px-2 font-medium text-center text-orange-600">过号合计</th>
                <th class="py-2 px-2 font-medium text-center text-indigo-500">预约激活</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in store.dashboard.byDepartment" :key="stat.department"
                  class="border-t border-slate-100 hover:bg-slate-50">
                <td class="py-3 px-2 font-semibold text-slate-800 sticky left-0 bg-white z-10">
                  <div class="flex items-center gap-1 cursor-pointer" @click="toggleDeptRooms(stat.department)">
                    <span class="text-xs text-slate-400">{{ expandedDepts[stat.department] ? '▼' : '▶' }}</span>
                    {{ stat.department }}
                  </div>
                </td>
                <td class="py-3 px-2 text-center">
                  <span @click="applyFilter(stat.department, '全部')"
                        class="inline-block min-w-[44px] rounded-lg px-2 py-1 bg-slate-100 text-slate-700 font-semibold cursor-pointer hover:bg-slate-200">
                    {{ stat.checkedIn }}
                  </span>
                </td>
                <td class="py-3 px-2 text-center">
                  <span @click="applyFilter(stat.department, 'waiting')"
                        :class="[
                          'inline-block min-w-[44px] rounded-lg px-2 py-1 font-semibold cursor-pointer',
                          stat.waiting > 0 ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-400'
                        ]">
                    {{ stat.waiting }}
                  </span>
                </td>
                <td class="py-3 px-2 text-center">
                  <span @click="applyFilter(stat.department, 'visiting')"
                        :class="[
                          'inline-block min-w-[44px] rounded-lg px-2 py-1 font-semibold cursor-pointer',
                          stat.visiting > 0 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 animate-pulse' : 'bg-slate-100 text-slate-400'
                        ]">
                    {{ stat.visiting }}
                  </span>
                </td>
                <td class="py-3 px-2 text-center">
                  <span @click="applyFilter(stat.department, 'completed')"
                        :class="[
                          'inline-block min-w-[44px] rounded-lg px-2 py-1 font-semibold cursor-pointer',
                          stat.completed > 0 ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-400'
                        ]">
                    {{ stat.completed }}
                  </span>
                </td>
                <td class="py-3 px-2 text-center">
                  <span @click="applyFilter(stat.department, 'missed')"
                        :class="[
                          'inline-block min-w-[44px] rounded-lg px-2 py-1 font-semibold cursor-pointer',
                          stat.missed > 0 ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-400'
                        ]">
                    {{ stat.missed }}
                  </span>
                </td>
                <td class="py-3 px-2 text-center">
                  <span @click="applyFilter(stat.department, 'preregistered')"
                        :class="[
                          'inline-block min-w-[44px] rounded-lg px-2 py-1 font-semibold cursor-pointer',
                          stat.preRegistered > 0 ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-slate-100 text-slate-400'
                        ]">
                    {{ stat.preRegistered }}
                  </span>
                </td>
                <td class="py-3 px-2 text-center border-l border-slate-200 font-bold text-slate-800">
                  {{ stat.totalSeen }}
                </td>
                <td class="py-3 px-2 text-center"
                    :class="stat.missedCountSum > 0 ? 'text-orange-600 font-semibold' : 'text-slate-400'">
                  {{ stat.missedCountSum }}
                </td>
                <td class="py-3 px-2 text-center"
                    :class="stat.apptActivated > 0 ? 'text-indigo-600 font-semibold' : 'text-slate-400'">
                  {{ stat.apptActivated }}
                </td>
              </tr>
              <tr class="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td class="py-3 px-2 text-slate-800 sticky left-0 bg-slate-50 z-10">📌 {{ store.dashboard.totals.department }}</td>
                <td class="py-3 px-2 text-center text-slate-800">{{ store.dashboard.totals.checkedIn }}</td>
                <td class="py-3 px-2 text-center text-amber-700">{{ store.dashboard.totals.waiting }}</td>
                <td class="py-3 px-2 text-center text-blue-700">{{ store.dashboard.totals.visiting }}</td>
                <td class="py-3 px-2 text-center text-green-700">{{ store.dashboard.totals.completed }}</td>
                <td class="py-3 px-2 text-center text-red-600">{{ store.dashboard.totals.missed }}</td>
                <td class="py-3 px-2 text-center text-purple-700">{{ store.dashboard.totals.preRegistered }}</td>
                <td class="py-3 px-2 text-center text-slate-800 border-l border-slate-200">{{ store.dashboard.totals.totalSeen }}</td>
                <td class="py-3 px-2 text-center text-orange-600">{{ store.dashboard.totals.missedCountSum }}</td>
                <td class="py-3 px-2 text-center text-indigo-600">{{ store.dashboard.totals.apptActivated }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-for="stat in store.dashboard.byDepartment" :key="'rooms-' + stat.department">
          <div v-if="expandedDepts[stat.department]" class="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div class="text-xs font-semibold text-slate-500 mb-3">🏥 {{ stat.department }} · 诊室交接视角</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div v-for="room in store.getRoomsByDepartment(stat.department)" :key="room.id"
                   class="p-3 rounded-lg border transition-all"
                   :class="room.currentPatient ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200'">
                <div class="flex items-center justify-between mb-2">
                  <div class="font-semibold text-sm text-slate-700">{{ room.name }}</div>
                  <span v-if="room.currentPatient" class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 animate-pulse">就诊中</span>
                  <span v-else class="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">空闲</span>
                </div>
                <div v-if="room.currentPatient" class="space-y-2">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-lg font-bold text-slate-800">{{ room.currentPatient.queueNumber }}号</span>
                      <span class="text-slate-700 ml-2">{{ maskName(room.currentPatient.name) }}</span>
                      <span v-if="room.currentPatient.displayPriority || room.currentPatient.priority"
                            class="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">优先</span>
                    </div>
                  </div>
                  <div class="text-xs text-slate-500">
                    已就诊 <span class="font-semibold text-blue-600">{{ getVisitDuration(room.currentPatient) }}</span>
                    <span v-if="isVisitOverTime(room.currentPatient)" class="text-red-500 ml-1">⚠ 超预计</span>
                  </div>
                </div>
                <div v-else class="text-xs text-slate-400 py-3 text-center">暂无就诊患者</div>
                <div class="mt-2 pt-2 border-t border-slate-100">
                  <div class="text-xs text-slate-500">下一位候诊：</div>
                  <div v-if="getNextInQueue(stat.department)" class="text-sm mt-1">
                    <span class="font-bold text-amber-700">{{ getNextInQueue(stat.department)!.queueNumber }}号</span>
                    <span class="text-slate-600 ml-1">{{ maskName(getNextInQueue(stat.department)!.name) }}</span>
                    <span v-if="getNextInQueue(stat.department)!.appointmentTime"
                          class="ml-1 text-xs text-purple-500">预约{{ formatApptHM(getNextInQueue(stat.department)!.appointmentTime) }}</span>
                  </div>
                  <div v-else class="text-xs text-slate-400 mt-1">队列为空</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[400px_1fr_380px] gap-4">
        <div class="space-y-4">
          <div class="bg-white rounded-2xl shadow-sm p-5">
            <h2 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📝</span> 患者签到 / 预约录入
            </h2>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">姓名</label>
                <input v-model="form.name" type="text" placeholder="请输入姓名"
                       class="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">手机号后4位</label>
                  <input v-model="form.phoneLast4" type="text" maxlength="4" placeholder="如 1234"
                         class="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm">
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">科室</label>
                  <select v-model="form.department"
                          class="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white">
                    <option v-for="d in store.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">预约时间（可选）</label>
                <input v-model="form.appointmentTime" type="datetime-local"
                       class="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm">
              </div>
              <div class="flex items-center gap-4 pt-1">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.priority" type="checkbox" class="w-4 h-4 rounded text-red-500">
                  <span class="text-xs text-slate-600">优先（老人/孕妇）</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.preRegistered" type="checkbox" class="w-4 h-4 rounded text-purple-500">
                  <span class="text-xs text-slate-600">暂不入队（仅录入预约）</span>
                </label>
              </div>
              <button @click="handleSubmit"
                      :disabled="submitting || !form.name || !form.department"
                      class="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition">
                {{ submitting ? '提交中...' : (form.preRegistered ? '录入预约' : '签到取号') }}
              </button>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm p-5">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-bold text-slate-800 flex items-center gap-2">
                <span>📞</span> 预约管理 · 待激活
                <span class="text-xs font-normal text-slate-400">（共{{ store.preRegistered.length }}）</span>
              </h2>
            </div>
            <div v-if="sortedPreRegistered.length === 0"
                 class="text-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-200 rounded-lg">
              暂无待激活预约
            </div>
            <div v-else class="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              <div v-for="(group, gkey) in groupedPreRegistered" :key="gkey">
                <div v-if="group.length > 0" class="mb-2">
                  <div class="text-xs font-semibold px-2 py-1 rounded inline-block mb-2"
                       :class="{
                         'bg-red-100 text-red-600': gkey === 'expired',
                         'bg-blue-100 text-blue-700': gkey === 'today',
                         'bg-slate-100 text-slate-600': gkey === 'tomorrow',
                         'bg-purple-100 text-purple-600': gkey === 'later'
                       }">
                    {{ groupLabels[gkey as keyof typeof groupLabels] }}（{{ group.length }}）
                  </div>
                </div>
                <div v-for="p in group" :key="p.id"
                     :class="[
                       'p-3 rounded-lg border mb-2 transition-all cursor-pointer hover:shadow-sm',
                       isAppointmentNear(p.appointmentTime) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                     ]">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="font-semibold text-slate-800 text-sm">{{ maskName(p.name) }}</div>
                      <div class="text-xs text-slate-500 mt-0.5">{{ p.department }}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-sm font-semibold text-purple-600">
                        {{ formatAppointmentTime(p.appointmentTime) }}
                      </div>
                      <span v-if="isAppointmentNear(p.appointmentTime) && p.status === 'preregistered'"
                            class="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 mt-1">
                        ⏰ 临近
                      </span>
                    </div>
                  </div>
                  <div class="flex gap-2 mt-2">
                    <button @click="handleActivate(p.id)"
                            class="flex-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600">
                      激活入队
                    </button>
                    <button @click="handleDelete(p.id)"
                            class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs hover:bg-slate-100">
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 class="font-bold text-slate-800 flex items-center gap-2">
              <span>📋</span> 今日患者列表
              <span class="text-xs font-normal text-slate-400">
                {{ store.filterDepartment !== '全部' || store.filterStatus !== '全部' ? '（筛选结果）' : '（全部）' }}
              </span>
            </h2>
            <div class="flex items-center gap-2 text-sm">
              <div class="text-xs text-slate-500">筛选：</div>
              <select v-model="store.filterDepartment"
                      class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white outline-none focus:border-blue-400">
                <option value="全部">全部科室</option>
                <option v-for="d in store.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
              <select v-model="store.filterStatus"
                      class="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white outline-none focus:border-blue-400">
                <option value="全部">全部状态</option>
                <option value="waiting">候诊中</option>
                <option value="visiting">就诊中</option>
                <option value="completed">已完成</option>
                <option value="missed">已过号</option>
                <option value="preregistered">待激活</option>
              </select>
              <button v-if="store.filterDepartment !== '全部' || store.filterStatus !== '全部'"
                      @click="clearFilter"
                      class="text-xs px-2 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                清除
              </button>
              <div class="text-xs text-slate-500 ml-2">
                共 {{ store.filteredPatients.length }} 条
              </div>
            </div>
          </div>

          <div class="overflow-x-auto -mx-5 px-5">
            <div class="min-w-[800px]">
              <div class="grid grid-cols-[70px_80px_1fr_100px_90px_110px_110px_1fr] gap-3 px-3 py-2 bg-slate-50 rounded-lg text-xs font-semibold text-slate-500 mb-2">
                <div>排队号</div>
                <div>状态</div>
                <div>姓名</div>
                <div>科室</div>
                <div>候诊/时长</div>
                <div>签到时间</div>
                <div>就诊开始</div>
                <div>操作</div>
              </div>
              <div v-if="sortedFilteredPatients.length === 0"
                   class="text-center text-slate-400 text-sm py-16 border-2 border-dashed border-slate-200 rounded-lg">
                暂无数据
              </div>
              <div v-for="p in sortedFilteredPatients" :key="p.id"
                   class="grid grid-cols-[70px_80px_1fr_100px_90px_110px_110px_1fr] gap-3 items-center px-3 py-3 mb-1 rounded-lg transition-all"
                   :class="rowClass(p)">
                <div>
                  <span class="text-xl font-bold" :class="numberClass(p)">{{ p.queueNumber || '—' }}</span>
                </div>
                <div>
                  <span :class="statusBadgeClass(p.status)">{{ statusLabel(p.status) }}</span>
                </div>
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-semibold text-slate-800">{{ maskName(p.name) }}</span>
                    <span v-if="p.realPriority || p.priority" class="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">优先</span>
                    <span v-else-if="p.displayPriority" class="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">优先</span>
                    <span v-if="p.appointmentTime" class="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">
                      预约{{ formatApptHM(p.appointmentTime) }}
                    </span>
                    <span v-if="p.missedCount > 0" class="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">过号×{{ p.missedCount }}</span>
                  </div>
                  <div class="text-xs text-slate-400 mt-0.5">手机尾号 {{ p.phoneLast4 }}</div>
                </div>
                <div class="text-sm text-slate-600">{{ p.department }}</div>
                <div>
                  <div v-if="p.status === 'waiting'" class="text-sm">
                    <span :class="p.estimatedWaitWarn ? 'text-yellow-600 font-semibold' : 'text-slate-600'">
                      {{ formatDur(p.waitDuration ?? 0) }}
                    </span>
                    <div v-if="p.estimatedWaitWarn" class="text-[10px] text-yellow-500">⚠ 等待超时</div>
                  </div>
                  <div v-else-if="p.status === 'visiting'" class="text-sm">
                    <span class="text-blue-600 font-semibold">{{ getVisitDuration(p) }}</span>
                  </div>
                  <div v-else-if="p.status === 'completed'" class="text-sm">
                    <span class="text-green-600">{{ getVisitDuration(p) }}</span>
                  </div>
                  <div v-else class="text-xs text-slate-400">—</div>
                </div>
                <div class="text-xs text-slate-500">{{ formatShort(p.checkInTime) }}</div>
                <div class="text-xs text-slate-500">{{ formatShort(p.visitStartTime) }}</div>
                <div>
                  <div class="flex gap-1.5 flex-wrap">
                    <button v-if="p.status === 'visiting'"
                            @click="handleMarkMissed(p.id)"
                            class="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium">
                      标记过号
                    </button>
                    <button v-if="p.status === 'visiting'"
                            @click="handleComplete(p.id)"
                            class="px-3 py-1.5 text-xs rounded-lg bg-green-50 text-green-600 hover:bg-green-100 font-medium">
                      完成就诊
                    </button>
                    <button v-if="p.status === 'waiting'"
                            @click="handlePrioritize(p.id)"
                            :disabled="p.realPriority || p.priority"
                            class="px-3 py-1.5 text-xs rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 font-medium disabled:opacity-40">
                      置顶
                    </button>
                    <button v-if="p.status === 'missed' || p.status === 'completed'"
                            @click="handleRequeue(p.id)"
                            class="px-3 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
                      重新入队（队尾+新号）
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm p-5 max-h-[calc(100vh-120px)] overflow-y-auto">
          <h2 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>🏥</span> 科室候诊一览
          </h2>
          <div class="space-y-4">
            <div v-for="dept in store.departments" :key="dept.id" class="p-4 rounded-xl border"
                 :class="getActiveVisitingRooms(dept).length > 0 ? 'bg-gradient-to-br from-blue-50 to-white border-blue-200' : 'bg-slate-50 border-slate-200'">
              <div class="flex items-center justify-between mb-3">
                <div class="font-bold text-slate-800">{{ dept.name }}</div>
                <div class="flex items-center gap-2">
                  <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    候诊 {{ dept.waitingCount ?? 0 }}
                  </span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                    均时 {{ formatDur(dept.avgVisitDuration) }}
                  </span>
                </div>
              </div>

              <div class="mb-3 space-y-1.5">
                <div v-for="room in getActiveVisitingRooms(dept)" :key="room.id"
                     class="flex items-center justify-between p-2 rounded-lg bg-blue-100/50 border border-blue-200">
                  <div>
                    <div class="text-xs font-medium text-blue-600">{{ room.name }}</div>
                    <div class="text-sm font-semibold text-slate-800 mt-0.5">
                      {{ room.currentPatient?.queueNumber }}号 · {{ maskName(room.currentPatient?.name || '') }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-xs font-semibold text-blue-600">{{ getVisitDuration(room.currentPatient ?? null) }}</div>
                  </div>
                </div>
              </div>

              <div class="mb-3 flex flex-wrap gap-1.5">
                <span v-for="room in (dept.rooms || [])" :key="'tag-' + room.id"
                      class="text-xs px-2 py-1 rounded-md font-medium"
                      :class="room.currentPatient ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'">
                  {{ room.name }}{{ room.currentPatient ? ' ' + (room.currentPatient as Patient).queueNumber + '号' : '' }}
                </span>
              </div>

              <div class="pt-3 border-t border-slate-200">
                <div class="text-xs text-slate-500 mb-2">候诊队列（共 {{ store.getDepartmentQueue(dept.name).length }} 位）</div>
                <div v-if="store.getDepartmentQueue(dept.name).length === 0" class="text-xs text-slate-400 py-2 text-center">
                  暂无候诊患者
                </div>
                <div v-else class="space-y-1 max-h-40 overflow-y-auto">
                  <div v-for="(p, idx) in store.getDepartmentQueue(dept.name).slice(0, 5)" :key="p.id"
                       class="flex items-center justify-between text-xs p-1.5 rounded"
                       :class="idx === 0 ? 'bg-amber-50' : ''">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold" :class="idx === 0 ? 'text-amber-600' : 'text-slate-700'">
                        {{ idx + 1 }}.{{ p.queueNumber }}号
                      </span>
                      <span class="text-slate-600">{{ maskName(p.name) }}</span>
                      <span v-if="p.realPriority || p.displayPriority" class="text-[10px] px-1 rounded bg-red-100 text-red-600">优先</span>
                      <span v-if="p.appointmentTime" class="text-[10px] px-1 rounded bg-purple-100 text-purple-600">预约</span>
                    </div>
                    <div class="text-slate-500">{{ formatDur(p.waitDuration ?? 0) }}</div>
                  </div>
                  <div v-if="store.getDepartmentQueue(dept.name).length > 5"
                       class="text-xs text-slate-400 text-center pt-1">
                    还有 {{ store.getDepartmentQueue(dept.name).length - 5 }} 位...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQueueStore } from './stores/queue'
import { formatDuration as formatDur, formatAppointmentTime, maskName, speakQueueNumber } from './types'
import type { Patient, Room, PatientStatus } from './types'

const store = useQueueStore()
const { queue, completed, departments, rooms, preRegistered, dashboard, wsConnected } = storeToRefs(store)

const expandedDepts = ref<Record<string, boolean>>({})

const form = ref({
  name: '',
  phoneLast4: '',
  department: '',
  appointmentTime: '',
  priority: false,
  preRegistered: false,
})
const submitting = ref(false)

const currentDate = computed(() => {
  return new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
})

const groupLabels = {
  expired: '⏳ 已过预约时间',
  today: '📍 今日预约',
  tomorrow: '📅 明日预约',
  later: '🗓 后续预约',
} as const

const sortedPreRegistered = computed(() => {
  return [...preRegistered.value].sort((a, b) => {
    const ta = a.appointmentTime ? new Date(a.appointmentTime).getTime() : Date.now() + 86400000 * 365
    const tb = b.appointmentTime ? new Date(b.appointmentTime).getTime() : Date.now() + 86400000 * 365
    return ta - tb
  })
})

const groupedPreRegistered = computed(() => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const tomorrowStart = todayStart + 86400000
  const dayAfterStart = tomorrowStart + 86400000

  const groups: Record<string, Patient[]> = { expired: [], today: [], tomorrow: [], later: [] }
  for (const p of sortedPreRegistered.value) {
    const t = p.appointmentTime ? new Date(p.appointmentTime).getTime() : null
    if (t === null) {
      groups.later.push(p)
    } else if (t < now.getTime()) {
      groups.expired.push(p)
    } else if (t < tomorrowStart) {
      groups.today.push(p)
    } else if (t < dayAfterStart) {
      groups.tomorrow.push(p)
    } else {
      groups.later.push(p)
    }
  }
  return groups
})

const sortedFilteredPatients = computed(() => {
  return [...store.filteredPatients].sort((a, b) => {
    const order: Record<PatientStatus | string, number> = {
      visiting: 0, waiting: 1, preregistered: 2, missed: 3, completed: 4
    }
    const sa = order[a.status] ?? 9
    const sb = order[b.status] ?? 9
    if (sa !== sb) return sa - sb
    if (a.department !== b.department) return a.department.localeCompare(b.department)
    const at = new Date(a.createdAt).getTime()
    const bt = new Date(b.createdAt).getTime()
    return bt - at
  })
})

function isAppointmentNear(timeStr?: string): boolean {
  if (!timeStr) return false
  const t = new Date(timeStr).getTime()
  const diff = t - Date.now()
  return diff > -1800000 && diff < 1800000
}

function formatApptHM(timeStr?: string): string {
  if (!timeStr) return ''
  try {
    const d = new Date(timeStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

function formatShort(timeStr?: string): string {
  if (!timeStr) return '—'
  try {
    const d = new Date(timeStr)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return timeStr }
}

function statusLabel(s: PatientStatus): string {
  return { waiting: '候诊', visiting: '就诊中', completed: '已完成', missed: '已过号', preregistered: '待激活' }[s]
}

function statusBadgeClass(s: PatientStatus): string {
  const base = 'inline-block text-xs px-2 py-0.5 rounded-full font-medium'
  return base + ' ' + {
    waiting: 'bg-amber-100 text-amber-700',
    visiting: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    missed: 'bg-red-100 text-red-600',
    preregistered: 'bg-purple-100 text-purple-700',
  }[s]
}

function numberClass(p: Patient): string {
  if (p.status === 'visiting') return 'text-blue-600'
  if (p.status === 'completed') return 'text-green-600'
  if (p.status === 'missed') return 'text-red-500 line-through opacity-60'
  if (p.status === 'preregistered') return 'text-slate-400'
  return 'text-slate-800'
}

function rowClass(p: Patient): string {
  if (p.status === 'visiting') return 'bg-blue-50 border border-blue-100'
  if (p.estimatedWaitWarn) return 'bg-yellow-50 border border-yellow-100'
  return 'bg-slate-50/40 hover:bg-slate-50'
}

function getVisitDuration(p: Patient | null): string {
  if (!p || !p.visitStartTime) return '—'
  const end = p.visitEndTime ? new Date(p.visitEndTime) : new Date()
  const sec = Math.floor((end.getTime() - new Date(p.visitStartTime).getTime()) / 1000)
  return formatDur(sec)
}

function isVisitOverTime(p: Patient): boolean {
  if (!p || !p.visitStartTime) return false
  const dept = departments.value.find(d => d.name === p.department)
  if (!dept || !dept.avgVisitDuration) return false
  const sec = Math.floor((Date.now() - new Date(p.visitStartTime).getTime()) / 1000)
  return sec > dept.avgVisitDuration * 1.5
}

function getActiveVisitingRooms(dept: { name: string; rooms?: Room[] }): Room[] {
  if (!dept.rooms) return []
  return dept.rooms.filter(r => r.currentPatient)
}

function getNextInQueue(deptName: string): Patient | null {
  const q = store.getDepartmentQueue(deptName)
  return q.length > 0 ? q[0] : null
}

function applyFilter(department: string, status: PatientStatus | '全部') {
  store.filterDepartment = department
  store.filterStatus = status
}

function clearFilter() {
  store.filterDepartment = '全部'
  store.filterStatus = '全部'
}

function toggleDeptRooms(deptName: string) {
  expandedDepts.value[deptName] = !expandedDepts.value[deptName]
}

async function handleSubmit() {
  if (!form.value.name || !form.value.department) return
  submitting.value = true
  try {
    await store.createPatient({
      name: form.value.name,
      phoneLast4: form.value.phoneLast4 || '0000',
      department: form.value.department,
      appointmentTime: form.value.appointmentTime || undefined,
      priority: form.value.priority,
      preRegistered: form.value.preRegistered,
    })
    form.value = { name: '', phoneLast4: '', department: form.value.department, appointmentTime: '', priority: false, preRegistered: false }
  } catch (e: any) {
    alert(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleActivate(id: number) {
  try {
    await store.activatePatient(id)
  } catch (e: any) {
    alert(e.message || '激活失败')
  }
}

async function handleDelete(id: number) {
  if (!confirm('确认取消此预约？')) return
  try {
    const res = await fetch(`/api/patients/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('取消失败')
    await store.fetchAllData()
  } catch (e: any) {
    alert(e.message || '取消失败')
  }
}

async function handleMarkMissed(id: number) {
  if (!confirm('确认标记该患者为过号？')) return
  try {
    await store.markMissed(id)
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function handleComplete(id: number) {
  if (!confirm('确认完成该患者就诊？')) return
  try {
    const res = await fetch(`/api/patients/${id}/complete`, { method: 'POST' })
    if (!res.ok) throw new Error('操作失败')
    await store.fetchAllData()
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function handlePrioritize(id: number) {
  try {
    await store.prioritizePatient(id)
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function handleRequeue(id: number) {
  if (!confirm('重新入队将分配新排队号并排到队尾，确认？')) return
  try {
    await store.requeuePatient(id)
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function handleExport() {
  try {
    await store.exportCSV()
  } catch (e: any) {
    alert(e.message || '导出失败')
  }
}

onMounted(async () => {
  if (departments.value.length > 0 && !form.value.department) {
    form.value.department = departments.value[0].name
  }
  await store.fetchAllData()
  if (departments.value.length > 0 && !form.value.department) {
    form.value.department = departments.value[0].name
  }
  store.connectWebSocket('reception')
})

onUnmounted(() => {
  store.disconnectWebSocket()
})

watch(() => store.lastCallNumber, (v) => {
  if (!v) return
  const entries = Object.entries(v)
  if (entries.length === 0) return
  const [roomId, qn] = entries[entries.length - 1]
  const room = store.getRoomById(roomId)
  if (qn) speakQueueNumber(qn, undefined, room?.name)
}, { deep: true })
</script>
