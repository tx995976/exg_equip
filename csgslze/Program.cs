var gls = new GameStateListener(10086);
var ws = new WatsonWsServer(port:10088);
ws.Logger = Console.WriteLine;

Subject<string> roundstate = new();
WsConn? recver = null;
IDisposable? rl = null;

roundstate.Subscribe(x => Console.WriteLine($"send ws data {x}"));

ws.ClientConnected += (o,e) => {
	recver = new(e.Client.Guid,ws);
	rl = roundstate.Subscribe(x => recver.send(x));

	Console.WriteLine($"client {e.Client.Ip} connected");
};

ws.ClientDisconnected += (o,e) => {
	Console.WriteLine($"client {e.Client.Ip} disconnected");
	recver?.disconnect();
	rl?.Dispose();
};

gls.RoundPhaseUpdated += (e) => {
	Console.WriteLine($"game state from {e.Previous} to {e.New}");
	if (e.New.ToString() == "Over")
		roundstate.OnNext($"RP:{e.New}");
	if (e.New.ToString() == "Live")
		roundstate.OnNext($"RP:{e.New}");
};

if(!gls.Start()){
	Console.WriteLine("failed to start");
}
 ws.Start();

Task.Delay(-1).Wait();
// Console.WriteLine("started press enter to exit");
// var c = Console.ReadLine();



class WsConn(Guid id,WatsonWsServer server) {
	public void send(string data){
		Task.Run(() => server.SendAsync(id,data));
	}

	public void disconnect(){
		Console.WriteLine($"client {id} disconnected");
		server.DisconnectClient(id);
	}
}