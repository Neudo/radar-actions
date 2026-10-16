import sys,json,datetime
import exchange_calendars as xc
import pandas as pd
exchange,cutoff=sys.argv[1:]
start=pd.Timestamp(cutoff).tz_convert('Europe/Paris' if exchange=='XPAR' else 'America/New_York').normalize().tz_localize(None)
end=start+pd.Timedelta(days=100)
cal=xc.get_calendar('XPAR' if exchange=='XPAR' else 'XNYS',start=start-pd.Timedelta(days=7),end=end+pd.Timedelta(days=7))
sessions=cal.sessions_in_range(start,end)
print(json.dumps([{'session':s.strftime('%Y-%m-%d'),'close_at':cal.session_close(s).isoformat()} for s in sessions]))
