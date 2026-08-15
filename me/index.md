---
layout: me
title: MS-DOS Prompt
winclass: dos-win
icon: msdos.svg
no_comment: true
---

<p>Microsoft(R) Windows 98<br>&nbsp;&nbsp;&nbsp;(C)Copyright Microsoft Corp 1981-1998.</p>

<p class="dos-cmd">C:\&gt;attrib hikikomori</p>
<p>&nbsp;&nbsp;&nbsp;H&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;C:\HIKIKOMORI</p>

<p class="dos-cmd">C:\&gt;cd hikikomori</p>

<p class="dos-cmd">C:\HIKIKO~1&gt;type me.txt</p>

Arsenal, Bichon Frisé, Coffee, Tattoo


**0-19**
- 1994: Born in Yeonhui-dong, Seoul, South Korea.
- 1995-1996: Temporarily raised in the Philippines, back to South Korea.
- 2001-2006: Enrolled in [Kyonggi Elementary School](https://namu.wiki/w/%EA%B2%BD%EA%B8%B0%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90), graduated from [Jamwon Elementary School](https://namu.wiki/w/%EC%84%9C%EC%9A%B8%EC%9E%A0%EC%9B%90%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90), suffered from tic disorders.
- 2007-2008: Enrolled in [Sinbanpo Middle School](https://namu.wiki/w/%EC%8B%A0%EB%B0%98%ED%8F%AC%EC%A4%91%ED%95%99%EA%B5%90), dropped out after the first year, played computer games, travelled Europe.
- 2009-2014: Moved to the UK, graduated from [Liverpool College](https://www.liverpoolcollege.org.uk/about-us/who-we-are).


**20-29**
- 2014-2017: Graduated from [King's College London](https://www.kcl.ac.uk/mathematics), **I Really Like Reading Mathematics**, back to South Korea.
- 2017: Interned at [Mercer](https://www.mercer.com/) and [KPMG](https://home.kpmg/xx/en/home.html), decided against a career in finance/consulting.
- 2018-2020: Worked at [Vingle](https://www.vingle.net/users/sign_up), joined the national guard.
- 2020-2021: Worked at [Riiid](https://www.riiid.co/), got rejected by Stanford, completed national guard service.
- 2022: Had an 8-month gap year, interviewed with Google, Palantir, Nvidia, Udemy, Blind, and others.


**30-39**
- 2023-2025: Worked at [Blind](https://www.teamblind.com/) as DS, transitioned to SWE/MLE, **I Got Married To My Life Partner**.
- 2026: Pursuing MS in CS (ML) at [Georgia Institute of Technology](https://www.gatech.edu/).

<p class="dos-cmd">C:\HIKIKO~1&gt;<span class="dos-cursor"></span></p>

<script>
(function () {
	var pane = document.querySelector('.dos-win .post_content');
	pane.querySelectorAll('li').forEach(function (li) {
		li.innerHTML = li.innerHTML.replace(/^(\d[\d-]*)/, '<span class="dos-yr">$1</span>');
	});
	pane.querySelectorAll('a').forEach(function (a) {
		a.target = '_blank';
		a.rel = 'noopener';
	});
	pane.scrollTop = pane.scrollHeight;
})();
</script>