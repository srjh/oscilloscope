var buttonCoords = [[20,410,68,370],[98,405,130,375],[194,405,226,375],[234,405,266,375],[278,405,292,375],[294,405,308,375]
,[365,405,380,380]//Leftcal
,[384,405,400,380]//Rightcal
,[435,80,465,64]//LposD
,[435,60,465,44]//LposU
,[430,134,448,90]
,[450,134,470,90]
,[426,180,472,146]
,[426,218,472,186],[426,256,472,221]
,[510,80,540,64]
,[510,60,540,44]
,[504,134,524,90],[526,134,546,90],[500,180,550,146]
,[500,218,550,186],[500,256,550,221]
,[586,74,598,44]
,[600,74,614,44]
,[580,134,598,90],[600,134,622,90],[575,180,625,146]
,[575,218,625,186],
[420,329,462,296],
[466,329,510,296],[514,329,556,296],[420,400,464,368],[470,400,516,368],[520,398,534,372]//Left curs
,[538,398,552,372]//Right Curs
,[584,296,615,282]//Trig down
,[584,280,615,262]//Trig up
,[570,336,598,308]//
,[602,336,628,308],[570,366,598,338],[602,366,628,338],[570,398,628,370]];



var timeScales = [0.1,0.05,0.02,0.01,0.005,0.002,0.001,0.0005,0.0002,0.0001,0.00005,0.00002,0.00001];
var timeScaleText = ["100 ms/div","50 ms/div","20 ms/div","10 ms/div","5 ms/div","2 ms/div","1 ms/div","0.5 ms/div","0.2 ms/div","0.1 ms/div","50 μs/div","20 μs/div","10 μs/div"];
var timeScaleIdx = 2;
var yScales = [1,0.5,0.2,0.1,0.05,0.02,0.01,0.005,0.002,0.001];
var yScaleText = ["1 U/div","0.5 U/div","0.2 U/div","0.1 U/div","50 mU/div","20 mU/div","10 mU/div","5 mU/div","2 mU/div","1 mU/div"];
var LScaleIdx = 2;
var RScaleIdx = 2;
var XCursor1 = 0;
var XCursor2 = 0;
var YCursor1 = 0;
var YCursor2 = 0;
var CursorSelXY = 0;//0: Off, 1: X, 2: Y
var CursorSel12 = 1;

var maxL=0;
var minL=0;
var minR=0;
var maxR=0;

var outMode = 0; //0-Off,1-Sqr,2-Sin
var trigchan = 0; //0-Left,1-Right,2-Internal
var chansel = 2; //0-Left,1-Right,2-Both,3-Sum,4-XY
var outFreq = 1000; //Test tone frequency
var calibrateFactor = 1; //By adjusting, you can read voltage directly
var vPerDivL = 0.25;
var vPerDivR = 0.25;

var trigLev = 0;//Between -1 and 1
var trigDiff=0;//Samples between two triggering events - i.e. Triggering period.
var levL=0;
var levR=0;
var iStep=0;

var img = new Image();
img.src = "scope2.png";
var audioBuffer = null;
var scopeCtx = null;
var outputGain, analyserNodeL, analyserNodeR, source = null;
window.AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new AudioContext();
var SAMPLE_RATE=audioContext.sampleRate;

function hasGetUserMedia() {
  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

function micCheck() {
if (!hasGetUserMedia())
  alert('Web audio input not supported.');
else
	initAudio();
}

function initAudio() {
	if (!navigator.getUserMedia)
		navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
	if (!navigator.cancelAnimationFrame)
		navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
	if (!navigator.requestAnimationFrame)
		navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;
    navigator.getUserMedia({
		audio: {optional: [{ echoCancellation: false }]}}, streamBegin, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
}

function streamBegin(stream) {
	var splitter = audioContext.createChannelSplitter(2);
	var merger = audioContext.createChannelMerger(2);
	outputGain = audioContext.createGain();
	
	var leftGain = audioContext.createGain();
	var rightGain=audioContext.createGain();
    outputGain.gain.value = 0.0;
	leftGain.gain.value = 1.00;
	rightGain.gain.value = 1.00;
	
    inputPoint = audioContext.createGain();

    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
	
    realAudioInput.connect( splitter );
    splitter.connect( rightGain, 1, 0 );//Right
	splitter.connect( leftGain, 0, 0 );//Left
	
    analyserNodeL = audioContext.createAnalyser();
    analyserNodeL.fftSize = 16384;

	analyserNodeR = audioContext.createAnalyser();
    analyserNodeR.fftSize = 16384;
	
	//audioInput.connect(scriptNode);
	rightGain.connect(analyserNodeR);
	leftGain.connect(analyserNodeL);
	
	audioInput.connect(inputPoint);
    inputPoint.connect( outputGain );
	
    outputGain.connect( audioContext.destination );
    updateAnalysers();
}

var scopeOn=true;
var spk,sqr,sin,invl,invr,xy,gndl,gndr,chlr,chsum,trigfall,trigl,trigr,trigint=false;
var trigrise,chboth = true;

var buttonnames = ["OnOff","Snd"];


function greenButton(i)
{
	scopeCtx.fillStyle = '#7FEE7F';
	scopeCtx.fillRect(buttonCoords[i][0],buttonCoords[i][3],(buttonCoords[i][2]-buttonCoords[i][0]),(buttonCoords[i][1]-buttonCoords[i][3]));
	scopeCtx.stroke();
}

function updateSound() {
	if(source)
	{	source.stop();
	}
	if(!audioBuffer)
		audioBuffer = audioContext.createBuffer(2,SAMPLE_RATE,SAMPLE_RATE);
	var bbb=audioBuffer.getChannelData(0);
	var bba=audioBuffer.getChannelData(1);	
	for (i=0;i<30*SAMPLE_RATE;i++){
		if(outMode==0){
			bba[i]=(0);
			bbb[i]=(0);
		}
		if(outMode==1)
			{
			if(Math.sin(2*3.14159265*i*outFreq/SAMPLE_RATE)>0)
				bba[i]=1;
			else
				bba[i]=-1;
			bbb[i]=bba[i];
		}
		if(outMode==2){
			bba[i]=Math.sin(2*3.14159265*i*outFreq/SAMPLE_RATE);
			bbb[i]=Math.sin(2*3.14159265*i*outFreq/SAMPLE_RATE);
		}
	}
	source = audioContext.createBufferSource();
	source.buffer = audioBuffer;
	source.connect(audioContext.destination);
	source.loop = true;
	source.start(0.0);
	source.noteOn(0);
}

function updateAnalysers(time) {
	var timeFloatDataL = new Float32Array(2*analyserNodeL.frequencyBinCount);
	var timeFloatDataR = new Float32Array(2*analyserNodeR.frequencyBinCount);
	
	analyserNodeL.getFloatTimeDomainData(timeFloatDataL);
	analyserNodeR.getFloatTimeDomainData(timeFloatDataR);

	//Full Scale time:
	
	var tfs = timeScales[timeScaleIdx]*10*SAMPLE_RATE;
	
	
	
	//Get Trigger Level
	
	var trigVolt = trigLev*vPerDivL*4;
	//var trigVolt = 0;
	//Get Trigger Index
	var trigIndex=0;
	//trigDiff=0;
	
	maxR=0;
	minR=0;
	maxL=0;
	minL=0;
	for(var i = 0; i < 16383;i++)
	{
		if(timeFloatDataL[i]>maxL)
			maxL=timeFloatDataL[i];
		if(timeFloatDataL[i]<minL)
			minL=timeFloatDataL[i];	
		if(timeFloatDataR[i]>maxR)
			maxR=timeFloatDataR[i];
		if(timeFloatDataR[i]<minR)
			minR=timeFloatDataR[i];		
		if((timeFloatDataL[i]>trigVolt)&&(timeFloatDataL[i+1]<trigVolt)&&(!trigrise)&&(trigchan==0))//Falling Left
		{
			if(trigIndex==0)
				trigIndex=i+(timeFloatDataL[i]-trigVolt)/(timeFloatDataL[i]-timeFloatDataL[i+1]);
			else
			{
				trigDiff=i+(timeFloatDataL[i]-trigVolt)/(timeFloatDataL[i]-timeFloatDataL[i+1])-trigIndex;
				break;
			}
		}
		if((timeFloatDataR[i]>0)&&(timeFloatDataR[i+1]<0)&&(!trigrise)&&(trigchan==1))//Falling Right
		{
			if(trigIndex==0)
				trigIndex=i+timeFloatDataR[i]/(timeFloatDataR[i]-timeFloatDataR[i+1]);
			else
			{
				trigDiff=i+timeFloatDataR[i]/(timeFloatDataR[i]-timeFloatDataR[i+1])-trigIndex;
				break;
			}
		}
		if((timeFloatDataL[i]<0)&&(timeFloatDataL[i+1]>0)&&(trigrise)&&(trigchan==0))//Rising Left
		{
			if(trigIndex==0)
				trigIndex=i+timeFloatDataL[i]/(timeFloatDataL[i]-timeFloatDataL[i+1]);
			else
			{
				trigDiff=i+timeFloatDataL[i]/(timeFloatDataL[i]-timeFloatDataL[i+1])-trigIndex;
				break;
			}
		}
		if((timeFloatDataR[i]<0)&&(timeFloatDataR[i+1]>0)&&(trigrise)&&(trigchan==1))//Falling Left
		{
			if(trigIndex==0)
				trigIndex=i+timeFloatDataR[i]/(timeFloatDataR[i]-timeFloatDataR[i+1]);
			else
			{
				trigDiff=i-trigIndex;
				break;
			}
		}
	}
	
	scopeCtx.clearRect(0, 0, canvasWidth, canvasHeight);
	
	scopeCtx.font="12px Arial";
	
	//LEFT
	if(chansel==0||chansel==2)
	{
	scopeCtx.fillStyle = 'red';
	scopeCtx.fillText("CH1: " + (yScaleText[LScaleIdx]).toString(),20,20);
	}
	
	if(chansel==1||chansel==2)
	{
		//RIGHT
		scopeCtx.fillStyle = 'blue';
		scopeCtx.fillText("CH2: " + (yScaleText[RScaleIdx]).toString(),120,20);
	}
	
	scopeCtx.fillStyle = 'black';
	scopeCtx.fillText("T: " + (timeScaleText[timeScaleIdx]).toString(),220,20);
	
	scopeCtx.fillStyle = 'black';
	scopeCtx.fillText("f: " + (SAMPLE_RATE/trigDiff).toFixed(1),20,360);
	
	//scopeCtx.fillStyle = 'black';
	//scopeCtx.fillText("T: " + trigVolt.toFixed(2),120,360);
	
	scopeCtx.fillStyle = 'grey';
	scopeCtx.fillText("FS=±" + calibrateFactor.toFixed(3) + " U",320,20);
	
	//IF CURSORS
	{
		scopeCtx.setLineDash([2,3]);
		{
		scopeCtx.strokeStyle = '#00aa00';
		scopeCtx.lineWidth = 1;
		scopeCtx.beginPath();
		scopeCtx.moveTo(206+XCursor1,25);
		scopeCtx.lineTo(206+XCursor1, 345);		
		scopeCtx.stroke();
		scopeCtx.beginPath();
		scopeCtx.moveTo(206+XCursor2,25);
		scopeCtx.lineTo(206+XCursor2, 345);		
		scopeCtx.stroke();
			scopeCtx.fillStyle = 'grey';
		scopeCtx.fillText("Δt: " + ((XCursor2-XCursor1)*0.025*timeScales[timeScaleIdx]).toFixed(3) + " s",120,360);
		
		}
		{
			scopeCtx.beginPath();
			scopeCtx.moveTo(5,185-YCursor1);
			scopeCtx.lineTo(405,185-YCursor1);		
			scopeCtx.stroke();
			scopeCtx.beginPath();
			scopeCtx.moveTo(5,185-YCursor2);
			scopeCtx.lineTo(405,185-YCursor2);		
			scopeCtx.stroke();
			if(chansel==3)
			{
				scopeCtx.fillStyle = 'green';
				scopeCtx.fillText("ΔY: " + (YCursor2-YCursor1).toFixed(1) + " ",220,360);
			}
			if(chansel==0||chansel==2)
			{
				scopeCtx.fillStyle = 'red';
				scopeCtx.fillText("ΔY1: " + (YCursor2-YCursor1).toFixed(1) + " ",220,360);
			}
			if(chansel==1||chansel==2)
			{
				scopeCtx.fillStyle = 'blue';
				scopeCtx.fillText("ΔY2: " + (YCursor2-YCursor1).toFixed(1) + " ",320,360);
			}
		}
		scopeCtx.setLineDash([1,0]);
	}
	
	
	
	
	if(chansel==4)
	{//XY Mode
		scopeCtx.strokeStyle = 'rgba(0, 127, 0, 0.04)';
		scopeCtx.lineWidth = 1;
		scopeCtx.beginPath();
		if(chansel==4)
		 {
			if(invl)
				vPerDivL=-yScales[LScaleIdx];
			else
				vPerDivL=yScales[LScaleIdx];
			if(invr)
				vPerDivR=-yScales[RScaleIdx];
			else
				vPerDivR=yScales[RScaleIdx];
			 
			 
		  for(var i = 0; i < 16384; i++) {
			var v = timeFloatDataR[i]*calibrateFactor/vPerDivR;
			var y = 186-40*v;
			v = timeFloatDataL[i]*calibrateFactor/vPerDivL;//Reuse v to calculate x
			x = 206 + 40*v;
			if(i === 0) {
			  scopeCtx.moveTo(x, y);
			} else {
			  scopeCtx.lineTo(x, y);
			}
		  }
		scopeCtx.stroke();
		}	
	}
	
	if(chansel==3)
	{//Sum Mode - Much of this is duplicated, "L" is actually the sum

	scopeCtx.fillStyle = 'green';
	scopeCtx.fillText("SUM: " + (yScaleText[LScaleIdx]).toString(),20,20);
	
	
	scopeCtx.strokeStyle = 'green';
	scopeCtx.lineWidth = 1;
	scopeCtx.beginPath();
	
	scopeCtx.moveTo(5, 186-levL);
	if(invl)
		vPerDivL=-1/yScales[LScaleIdx];
	else
		vPerDivL=1/yScales[LScaleIdx];
	if(invr)
		vPerDivR=-1/yScales[LScaleIdx];
	else
		vPerDivR=1/yScales[LScaleIdx];
	if(gndl)
	{
		vPerDivL=0;
	}
	if(gndr)
	{
		vPerDivR=0;
	}
	else
	for(var i=Math.floor(trigIndex);i<16384-iStep;i++)
	{
		var x=6+400*(i-trigIndex)/tfs;
		if(x>410)
			break;
		var y=186-levL-timeFloatDataL[i+iStep]*40*calibrateFactor*vPerDivL-timeFloatDataR[i+iStep]*40*calibrateFactor*vPerDivR;
		if(y>346)
			y=346;
		else if(y<26)
			y=26;
		scopeCtx.lineTo(x, y);

	}
	
	
	scopeCtx.stroke();		
	}
	
	if(chansel<3)
	{//Normal Two Channel Mode

	if(chansel==0||chansel==2)
	{
		scopeCtx.strokeStyle = '#FF0000';
		scopeCtx.lineWidth = 1;
		scopeCtx.beginPath();
		
		scopeCtx.moveTo(5, 186-levL);
		if(invl)
			vPerDivL=-yScales[LScaleIdx];
		else
			vPerDivL=yScales[LScaleIdx];
		if(gndl)
		{
			scopeCtx.lineTo(405, 186-levL);
			
			scopeCtx.lineTo(5, 186-levL);
		}
		else
		for(var i=Math.floor(trigIndex);i<16384-iStep;i++)
		{
			var x=6+400*(i-trigIndex)/tfs;
			if(x>410)
				break;
			var y=186-levL-timeFloatDataL[i+iStep]*40*calibrateFactor/vPerDivL;
			if(y>346)
				y=346;
			else if(y<26)
				y=26;
			scopeCtx.lineTo(x, y);
		}
		scopeCtx.stroke();
	}
	if(chansel==1||chansel==2)
	{
		scopeCtx.strokeStyle = 'blue';
		scopeCtx.lineWidth = 1;
		scopeCtx.beginPath();
		scopeCtx.moveTo(5, 186-levR);

		if(invr)
			vPerDivR=-yScales[RScaleIdx];
		else
			vPerDivR=yScales[RScaleIdx];
			
		if(gndr)
		{
			scopeCtx.lineTo(405, 186-levR);
		}		
		else	
			for(var i=Math.floor(trigIndex);i<16384-iStep;i++)
			{
				var x=6+400*(i-trigIndex)/tfs;
				var y=186-levR-timeFloatDataR[i+iStep]*40*calibrateFactor/vPerDivR;

				if(y>345)
					y=345;
				else if(y<25)
					y=25;
				scopeCtx.lineTo(x, y);
				if(x>405)
					break;
			}
		scopeCtx.stroke();
	}
	}
	updateAll();
    rafID = window.requestAnimationFrame( updateAnalysers );
}



function updateAll()
{
		var canvas = document.getElementById("analyser2");
		canvasWidth = canvas.width;
        canvasHeight = canvas.height;

        scopeCtx = canvas.getContext('2d');
		//scopeCtx.clearRect( 0, 0, 640, 420 )
		//scopeCtx.fillStyle = '#F6D565';
		//scopeCtx.fillRect(0,0,640,420);
		//scopeCtx.stroke();
		greenButton(0);
		if(scopeOn)
			greenButton(0);
		if(spk)
			greenButton(1);
		if(outMode==1)
			greenButton(2);
		if(outMode==2)
			greenButton(3);
		if(invl)
			greenButton(12);
		if(invr)
			greenButton(19);
		if(gndl)
			greenButton(14);
		if(gndr)
			greenButton(21);
		if(chansel==4)
			greenButton(26);
		if(chansel==0||chansel==2)
			greenButton(28);
		if(chansel==1||chansel==2)
			greenButton(29);
		if(chansel==3)
			greenButton(30);
		if(trigrise)
			greenButton(37);
		else
			greenButton(38);
		if(trigchan==0)
			greenButton(39);
		if(trigchan==1)
			greenButton(40);			
		if(trigchan==2)
			greenButton(41);			
		scopeCtx.drawImage(img,0,0);
}

var b=true;

$( "#analyser2" ).mousedown(function(e) {
  e.preventDefault();
});

$('#analyser2').dblclick(function (e) {
   if(document.selection && document.selection.empty) {
        document.selection.empty();
    } else if(window.getSelection) {
        var sel = window.getSelection();
        sel.removeAllRanges();
    }
});

$('#analyser2').click(function (e) {
	var NUM_BUTTONS=42;
    var clickedX = e.pageX - this.offsetLeft;
    var clickedY = e.pageY - this.offsetTop;
    var button=-1;
	//console.log(clickedX + " " + clickedY);
	
	for(var i=0;i<NUM_BUTTONS;i++)
	{
		//Check Button
		if(clickedX>buttonCoords[i][0]&&clickedX<buttonCoords[i][2]&&clickedY<buttonCoords[i][1]&&clickedY>buttonCoords[i][3])
		{
			//greenButton(i);
			button=i;
			break;
		}
	}
	if(i<NUM_BUTTONS)
		$('#moo').html(i);
	switch(button)
	{
	case 0:
		
		break;
	case 1:
		spk=!spk;
		if(spk)
			outputGain.gain.value = 0.35;
		else
			outputGain.gain.value = 0.0;
		break;
	case 2:
		if(outMode==1)
			outMode=0;
		else
			outMode=1;
		updateSound();
		break;
	case 3:
		if(outMode==2)
			outMode=0;
		else
			outMode=2;
		updateSound();
		break;
	case 4:
		//outFreq=0.5*outFreq;
		//updateSound();
		break;
	case 5:
		//outFreq=2*outFreq;
		//updateSound();
		break;
	case 6:
		calibrateFactor-=0.01;
		break;
	case 7:
		calibrateFactor+=0.01;
		break;
	case 8:
		levL-=1;
		break;
	case 9:
		levL+=1;
		break;
	case 10:
		LScaleIdx-=1;
		if(LScaleIdx<0)
			LScaleIdx=0;
		break;
	case 11:
		LScaleIdx+=1;
		if(LScaleIdx>8)
			LScaleIdx=8;
		break;
	case 12:
		invl=!invl;
		break;	
	case 13:
		LScaleIdx=Math.floor(-4*Math.log10(maxL-minL)+2);
		if(LScaleIdx<0)
			LScaleIdx=0;
		else if(LScaleIdx>9)
			LScaleIdx=9;
	break;
	case 14:
		gndl=!gndl;
		break;
	case 15:
		levR-=1;
		break;
	case 16:
		levR+=1;
		break;	
	case 17:
		RScaleIdx-=1;
		if(RScaleIdx<0)
			RScaleIdx=0;
		break;
	case 18:
		RScaleIdx+=1;
		if(RScaleIdx>9)
			RScaleIdx=9;
		break;
	case 19:
		invr=!invr;
		break;
	case 20:
		RScaleIdx=Math.floor(-4*Math.log10(maxR-minR)+2);
		if(RScaleIdx<0)
			RScaleIdx=0;
		else if(RScaleIdx>9)
			RScaleIdx=9;
		break;
	case 21:
		gndr=!gndr;
		break;	
	case 22:
	if(iStep>5)
		iStep-=5;
	else
		if(trigDiff>5)
			iStep=Math.floor(trigDiff)-iStep;
		break;
	case 23:
		iStep+=5;
		break;
	case 24:
		timeScaleIdx-=1;
		if(timeScaleIdx<0)
			timeScaleIdx=0;
		break;
	case 25:
		timeScaleIdx+=1;
		if(timeScaleIdx>12)
			timeScaleIdx=12;
		break;
	case 26:
		chansel=4;
		break;
	case 27:
		timeScaleIdx=Math.floor(-4*Math.log10(trigDiff/SAMPLE_RATE)-3);
		if(timeScaleIdx<0)
			timeScaleIdx=0;
		else if(timeScaleIdx>12)
			timeScaleIdx=12;
		break;
	case 28:
		if(chansel==2)
			chansel=1;
		else
			chansel=2;
		break;
	case 29:
		if(chansel==2)
			chansel=0;
		else
			chansel=2;
		break;
	case 30:
		chansel=3;
		break;
	case 31:
		//1 or 2
		//206 186 40
		if(CursorSelXY==1)
		{
			//Flip it
			if(CursorSel12==1)
				CursorSel12=2;
			else
				CursorSel12=1;
		}
		else
		{
			CursorSelXY=1;
			CursorSel12=1;
		}
		break;
	case 32:
		//X or Y
		if(CursorSelXY==2)
		{
			//Flip it
			if(CursorSel12==1)
				CursorSel12=2;
			else
				CursorSel12=1;
		}
		else
		{
			CursorSelXY=2;
			CursorSel12=1;
		}
		break;
	case 33:
		if(CursorSelXY==1)
		{
			if(CursorSel12==1)
				XCursor1--;			
			else
				XCursor2--;
		}
		else if(CursorSelXY==2)
		{
			if(CursorSel12==1)
				YCursor1--;			
			else
				YCursor2--;
		}

		break;
	case 34:
		if(CursorSelXY==1)
		{
			if(CursorSel12==1)
				XCursor1++;			
			else
				XCursor2++;
		}
		else if(CursorSelXY==2)
		{
			if(CursorSel12==1)
				YCursor1++;			
			else
				YCursor2++;
		}
		break;
	case 35:
		trigLev=trigLev-0.01;
		break;		
	case 36:
		trigLev=trigLev+0.01;
		break;
	case 37:
		trigrise=true;
		break;
	case 38:
		trigrise=false;
		break;
	case 39:
		trigchan=0;
		break;
	case 40:
		trigchan=1;
		break;
	case 41:
		//trigchan=2; Internal triggering, obsolete
		trigLev=0;
		break;	
	}
	updateAll();
});